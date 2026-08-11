from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db, SessionLocal
from app.api.deps import get_current_user
from app.models.users import User
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from app.services.gemini_service import gemini_service
from pydantic import BaseModel
from typing import List, Optional, Dict
import polars as pl
import os
import re
from datetime import datetime

router = APIRouter(prefix="/finance", tags=["Personal Finance Auto-Categorizer"])

class ReclassifyRequest(BaseModel):
    table_name: str
    row_id: int
    new_category: str

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_bank_statement(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a bank statement CSV/Excel, detect columns,
    auto-categorize transactions using Gemini, and insert into a PostgreSQL table.
    """
    # 1. Validation & file reading
    filename = file.filename
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in [".csv", ".xlsx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personal Finance currently supports .csv and .xlsx statements."
        )

    # Save raw file locally in uploads folder
    temp_filename = f"finance_{current_user.id}_{int(datetime.utcnow().timestamp())}{file_ext}"
    target_path = os.path.join("uploads", temp_filename)
    os.makedirs("uploads", exist_ok=True)
    
    try:
        content = await file.read()
        with open(target_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file: {str(e)}"
        )

    # 2. Parse file using Polars
    try:
        if file_ext == ".csv":
            df = pl.read_csv(target_path)
        else:
            df = pl.read_excel(target_path)
    except Exception as e:
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Polars failed to read statement files: {str(e)}"
        )

    # Clean headers to standard casing
    columns = [c.strip() for c in df.columns]
    df.columns = columns
    
    # 3. Detect Columns Case-Insensitively
    date_col = next((c for c in columns if re.search(r"date", c, re.IGNORECASE)), None)
    desc_col = next((c for c in columns if re.search(r"desc|narrative|particulars|detail|memo", c, re.IGNORECASE)), None)
    debit_col = next((c for c in columns if re.search(r"debit|spent|withdraw|amount|out", c, re.IGNORECASE)), None)
    credit_col = next((c for c in columns if re.search(r"credit|deposit|received|in", c, re.IGNORECASE)), None)

    if not date_col or not desc_col:
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not detect Date and Description columns in statement. Please ensure columns are named clearly."
        )

    # 4. Extract Unique Narratives & run AI Categorizer
    # Filter out empty descriptions
    unique_narratives = df.select(desc_col).unique().to_series().to_list()
    unique_narratives = [n for n in unique_narratives if n and str(n).strip()]

    # Generate classifications map
    category_map = gemini_service.categorize_narratives(unique_narratives)

    # 5. Create database table dynamically for this statement
    safe_file_name = re.sub(r"[^a-zA-Z0-9]", "_", os.path.splitext(filename)[0]).lower()
    dynamic_table_name = f"finance_{current_user.id}_{safe_file_name}"
    
    try:
        # Create Table Structure
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {dynamic_table_name} (
            id SERIAL PRIMARY KEY,
            date DATE,
            description VARCHAR(255),
            debit NUMERIC(12, 2) DEFAULT 0,
            credit NUMERIC(12, 2) DEFAULT 0,
            category VARCHAR(100) DEFAULT 'Miscellaneous'
        );
        """
        await db.execute(text(create_table_sql))
        
        # Truncate if table already exists (overwriting old upload for same statement name)
        await db.execute(text(f"TRUNCATE TABLE {dynamic_table_name};"))
        await db.commit()
    except Exception as dberr:
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database schema generation error: {str(dberr)}"
        )

    # 6. Insert data rows
    rows_inserted = 0
    try:
        for row in df.iter_rows(named=True):
            # Parse Date
            raw_date = row[date_col]
            parsed_date = None
            if raw_date:
                # Try common formats
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
                    try:
                        parsed_date = datetime.strptime(str(raw_date).split(" ")[0], fmt).date()
                        break
                    except ValueError:
                        continue
            if not parsed_date:
                parsed_date = datetime.utcnow().date()
                
            # Parse Amounts
            raw_debit = row.get(debit_col) if debit_col else 0
            raw_credit = row.get(credit_col) if credit_col else 0
            
            debit_val = float(raw_debit) if raw_debit and str(raw_debit).strip() and str(raw_debit).lower() != "nan" else 0.0
            credit_val = float(raw_credit) if raw_credit and str(raw_credit).strip() and str(raw_credit).lower() != "nan" else 0.0
            
            desc_val = str(row[desc_col]) if row[desc_col] else "Unknown Transaction"
            category_val = category_map.get(desc_val, "Miscellaneous")
            
            insert_query = f"""
            INSERT INTO {dynamic_table_name} (date, description, debit, credit, category)
            VALUES (:date, :desc, :debit, :credit, :category);
            """
            await db.execute(text(insert_query), {
                "date": parsed_date,
                "desc": desc_val,
                "debit": debit_val,
                "credit": credit_val,
                "category": category_val
            })
            rows_inserted += 1

        # 7. Log to file lineage registry
        lineage_info = {
            "action": "FINANCE_UPLOAD",
            "db_table": dynamic_table_name,
            "columns": ["date", "description", "debit", "credit", "category"],
            "categorized_items_count": len(category_map)
        }
        
        db_file = UploadedFile(
            filename=filename,
            version=1,
            file_path=target_path,
            status="COMPLETED",
            workflow_status="APPROVED", # Finance sheets are immediately approved for the individual user
            owner_id=current_user.id,
            lineage_info=lineage_info
        )
        db.add(db_file)
        
        # Audit Logs
        audit = AuditLog(
            user_id=current_user.id,
            action="FINANCE_STATEMENT_PROCESSED",
            details=f"Personal finance statement '{filename}' parsed. Loaded {rows_inserted} transactions into table '{dynamic_table_name}'.",
            lineage_step="AI_CATEGORIZED"
        )
        db.add(audit)
        
        await db.commit()
        return {
            "status": "SUCCESS",
            "message": f"Successfully parsed and auto-categorized statement '{filename}'.",
            "table_name": dynamic_table_name,
            "rows_loaded": rows_inserted
        }
        
    except Exception as insert_err:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inserting transactions: {str(insert_err)}"
        )

@router.get("/stats")
async def get_statement_stats(
    table_name: str = Query(..., description="The dynamic PostgreSQL table of bank statement"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated categories summaries, monthly cashflows,
    and full transaction items.
    """
    # Security: Ensure user owns the table (checking table name prefix contains user_id)
    expected_prefix = f"finance_{current_user.id}_"
    if not table_name.startswith(expected_prefix):
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this statement table."
        )

    try:
        # 1. Total debits and credits
        totals_query = f"SELECT SUM(debit) as total_debit, SUM(credit) as total_credit FROM {table_name}"
        totals_res = await db.execute(text(totals_query))
        totals = totals_res.fetchone()
        
        total_debit = float(totals[0]) if totals and totals[0] else 0.0
        total_credit = float(totals[1]) if totals and totals[1] else 0.0

        # 2. Debits grouped by category (expenses pie)
        cat_query = f"""
        SELECT category, SUM(debit) as spent 
        FROM {table_name} 
        WHERE debit > 0 
        GROUP BY category 
        ORDER BY spent DESC
        """
        cat_res = await db.execute(text(cat_query))
        categories = [{"category": row[0], "spent": float(row[1])} for row in cat_res.fetchall()]

        # 3. All transaction list ordered by date
        tx_query = f"SELECT id, date, description, debit, credit, category FROM {table_name} ORDER BY date DESC"
        tx_res = await db.execute(text(tx_query))
        transactions = []
        for r in tx_res.fetchall():
            transactions.append({
                "id": r[0],
                "date": r[1].strftime("%Y-%m-%d") if r[1] else "",
                "description": r[2],
                "debit": float(r[3]) if r[3] else 0.0,
                "credit": float(r[4]) if r[4] else 0.0,
                "category": r[5]
            })

        return {
            "total_debit": total_debit,
            "total_credit": total_credit,
            "categories": categories,
            "transactions": transactions
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statement stats: {str(e)}"
        )

@router.post("/reclassify")
async def override_category(
    req: ReclassifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually override and reclassify the category of a transaction.
    """
    expected_prefix = f"finance_{current_user.id}_"
    if not req.table_name.startswith(expected_prefix):
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not own this statement table."
        )

    try:
        update_query = f"UPDATE {req.table_name} SET category = :category WHERE id = :id"
        await db.execute(text(update_query), {"category": req.new_category, "id": req.row_id})
        
        # Log audit log
        audit = AuditLog(
            user_id=current_user.id,
            action="FINANCE_TRANSACTION_RECLASSIFIED",
            details=f"Reclassified transaction ID {req.row_id} in table '{req.table_name}' to '{req.new_category}'.",
            lineage_step="UI_CORRECTED"
        )
        db.add(audit)
        await db.commit()
        return {"status": "SUCCESS", "message": "Transaction reclassified successfully."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reclassification update failed: {str(e)}"
        )
