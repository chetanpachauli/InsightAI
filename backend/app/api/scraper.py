from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.users import User
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from app.services.gemini_service import gemini_service
from app.api.files import run_etl_task
from app.core.config import settings
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
from bs4 import BeautifulSoup
import csv
import json
import os
import re
import socket
import ipaddress
from urllib.parse import urlparse
from datetime import datetime

router = APIRouter(prefix="/scraper", tags=["AI Web Scraper"])

class ScrapeRequest(BaseModel):
    url: str
    extraction_goal: str

def is_blocked_ssrf_target(url: str) -> bool:
    """Reject URLs that resolve to private, loopback, or link-local IPs (SSRF guard)."""
    hostname = urlparse(url).hostname
    if not hostname:
        return True
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return True  # Unresolvable host -> cannot verify, block it
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return True
    return False

@router.post("/extract", status_code=status.HTTP_200_OK)
async def extract_website_data(
    req: ScrapeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Scrape target URL, minify HTML/Text, and call Gemini
    to extract structured CSV tables based on custom goals.
    """
    url = req.url
    goal = req.extraction_goal

    # 1. Simple URL validation
    if not url.startswith("http://") and not url.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL. Must begin with http:// or https://"
        )

    # 1b. SSRF guard: block internal/private network targets
    if is_blocked_ssrf_target(url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This URL resolves to a private or internal network address and cannot be scraped."
        )

    # 2. Fetch raw HTML content
    html_content = ""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    max_bytes = settings.MAX_FILE_UPLOAD_MB * 1024 * 1024
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=15.0, follow_redirects=True)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Target website returned status code: {response.status_code}"
                )
            # Guard against huge pages (SSRF-safe memory limit)
            declared_size = response.headers.get("content-length")
            if declared_size and declared_size.isdigit() and int(declared_size) > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Target page exceeds the {settings.MAX_FILE_UPLOAD_MB}MB size limit."
                )
            html_content = response.text
            if len(html_content.encode("utf-8")) > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Target page exceeds the {settings.MAX_FILE_UPLOAD_MB}MB size limit."
                )
    except HTTPException:
        raise
    except Exception as fetch_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch website contents: {str(fetch_err)}"
        )

    # 3. Clean and minify page nodes (Remove styles, JS, tracking nodes)
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "head", "meta", "iframe", "noscript"]):
            tag.decompose()
        
        # Extract minified text body
        minified_text = soup.get_text(separator="\n", strip=True)
        # Safe limit: first 25,000 characters to prevent prompt bloat
        minified_text = minified_text[:25000]
    except Exception as parse_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BeautifulSoup parsing failed: {str(parse_err)}"
        )

    # 4. Prompt Gemini for structured semantic extraction
    prompt = f"""
    You are an expert web scraping parser.
    Extract a structured table list of items from the website content below based on this specific goal:
    "{goal}"

    Guidelines:
    1. Scan the text to find matching item listings (e.g., list of products and their prices, or a list of news headlines and their links/dates).
    2. Convert the items into a clean, unified JSON array of objects.
    3. Choose clear, flat key names for the columns (e.g. "product_title", "price", "description" or "headline", "publish_date").
    4. Only return a raw JSON array. Do not include markdown code block syntax (like ```json ... ```).
    5. If no items match the goal, return an empty array: []

    Website Content:
    {minified_text}
    """

    scraped_data = []
    if not gemini_service.is_configured():
        # Fallback dummy list for testing
        scraped_data = [
            {"title": "Sample Product A from Webpage", "price": "$19.99", "status": "In Stock"},
            {"title": "Sample Product B from Webpage", "price": "$29.99", "status": "Low Stock"},
            {"title": "Sample Product C from Webpage", "price": "$9.99", "status": "Out of Stock"}
        ]
    else:
        try:
            response = gemini_service.client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt
            )
            # Remove any wrapping codeblock markup from Gemini if present
            raw_text = response.text.strip()
            if raw_text.startswith("```"):
                # strip code block tags
                lines = raw_text.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()
            
            scraped_data = json.loads(raw_text)
        except Exception as ai_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Gemini parsing failed. Raw response was not valid JSON: {str(ai_err)}"
            )

    if not isinstance(scraped_data, list) or len(scraped_data) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract any matching items based on your scraping goal. Please refine the goal prompt."
        )

    # 5. Compile records to CSV
    safe_title = re.sub(r"[^a-zA-Z0-9]", "_", url.split("//")[-1].split("/")[0])
    csv_filename = f"scraped_{safe_title}_{int(datetime.utcnow().timestamp())}.csv"
    os.makedirs("uploads", exist_ok=True)
    target_path = os.path.join("uploads", csv_filename)
    
    try:
        # Extract headers dynamically from first element keys
        headers = list(scraped_data[0].keys())
        
        with open(target_path, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for row in scraped_data:
                writer.writerow(row)
                
        # Register file in database registry. Status starts as PENDING so the
        # background ETL pipeline converts the CSV into a real queryable table.
        db_file = UploadedFile(
            filename=csv_filename,
            version=1,
            file_path=target_path,
            status="PENDING",
            workflow_status="DRAFT", # Starts as draft so managers can audit and approve before SQL chat
            owner_id=current_user.id,
            lineage_info={
                "action": "WEB_SCRAPED",
                "scraped_url": url,
                "extraction_goal": goal,
                "rows_extracted": len(scraped_data)
            }
        )
        db.add(db_file)
        await db.flush()
        file_id = db_file.id

        # Audit log tracking
        audit = AuditLog(
            user_id=current_user.id,
            action="WEBPAGE_SCRAPED",
            details=f"Scraped '{url}' using goal: '{goal}'. Compiled {len(scraped_data)} items to CSV '{csv_filename}'.",
            lineage_step="RAW_SCRAPED"
        )
        db.add(audit)
        
        await db.commit()

        # Convert CSV into a real PostgreSQL table (background) so the sheet can
        # be queried via AI Chat / Pivot after approval.
        background_tasks.add_task(run_etl_task, file_id)

        return {
            "message": f"Website scraped successfully! Compiled {len(scraped_data)} rows.",
            "data": scraped_data,
            "filename": csv_filename
        }
    except Exception as save_err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error compiling and writing scraped data CSV: {str(save_err)}"
        )
