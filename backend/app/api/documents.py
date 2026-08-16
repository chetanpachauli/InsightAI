from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.users import User
from app.models.documents import DocumentChunk
from app.models.audit_logs import AuditLog
from app.services.gemini_service import gemini_service
from app.core.rate_limit import limiter, AI_RATE_LIMIT, UPLOAD_RATE_LIMIT
from google.genai import types
from pydantic import BaseModel
from typing import List, Optional
from app.core.config import settings
import os
import math
import json

router = APIRouter(prefix="/documents", tags=["AI Document Hub & RAG Engine"])

class DocQueryRequest(BaseModel):
    question: str

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate the cosine similarity between two vectors."""
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_v1 = math.sqrt(sum(x * x for x in v1))
    norm_v2 = math.sqrt(sum(x * x for x in v2))
    if not norm_v1 or not norm_v2:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

def generate_embedding(text: str) -> List[float]:
    """Call Gemini to generate a 3072-dimension vector embedding."""
    if not gemini_service.is_configured():
        # Fallback dummy vector for dry run tests if key is missing
        return [0.1] * 3072

    try:
        response = gemini_service.client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        # Extract values
        return response.embeddings[0].values
    except Exception as e:
        raise RuntimeError(f"Error calling Gemini Embedding API: {str(e)}")

@router.post("/upload", status_code=status.HTTP_201_CREATED)
@limiter.limit(UPLOAD_RATE_LIMIT)
async def upload_document(
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    current_user: User = Depends(RoleChecker(allowed_roles=["Admin", "MIS"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a text document (.txt, .md).
    Chunk it, generate embeddings, and save to Postgres.
    """
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in [".txt", ".md"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document Hub currently supports .txt and .md files."
        )

    try:
        # Read content (with size guard to avoid memory abuse)
        content_bytes = await file.read(settings.MAX_FILE_UPLOAD_MB * 1024 * 1024 + 1)
        if len(content_bytes) > settings.MAX_FILE_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds the {settings.MAX_FILE_UPLOAD_MB}MB upload limit."
            )
        content_text = content_bytes.decode("utf-8")
        
        # 1. Chunking logic (500 chars limit, 100 overlap)
        chunk_size = 500
        overlap = 100
        chunks = []
        
        start = 0
        while start < len(content_text):
            end = start + chunk_size
            chunks.append(content_text[start:end])
            start += (chunk_size - overlap)

        # 2. Generate embeddings and save each chunk
        for idx, chunk_text in enumerate(chunks):
            if not chunk_text.strip():
                continue
            
            vector = generate_embedding(chunk_text)
            
            db_chunk = DocumentChunk(
                filename=file.filename,
                chunk_index=idx,
                content=chunk_text,
                embedding=vector
            )
            db.add(db_chunk)

        # Audit trail logging
        audit = AuditLog(
            user_id=current_user.id,
            action="DOC_UPLOAD",
            details=f"Uploaded document '{file.filename}' processed into {len(chunks)} vector chunks.",
            lineage_step="VECTOR_INDEX"
        )
        db.add(audit)
        
        await db.commit()
        return {"message": f"Successfully indexed '{file.filename}' into {len(chunks)} vector chunks."}

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse and index document: {str(e)}"
        )

@router.post("/query")
@limiter.limit(AI_RATE_LIMIT)
async def query_knowledge_base(
    request: Request,
    response: Response,
    query_in: DocQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Perform semantic search:
    1. Generate embedding for user question.
    2. Retrieve all chunk vectors and compute cosine similarity.
    3. Take top 3 chunks as context.
    4. Call Gemini to answer based on context.
    """
    try:
        # 1. Generate query vector
        query_vector = generate_embedding(query_in.question)
        
        # 2. Fetch all document chunks from database
        result = await db.execute(select(DocumentChunk))
        all_chunks = result.scalars().all()
        
        if not all_chunks:
            return {
                "answer": "Document Hub is empty. Please upload text manuals or company policies first.",
                "sources": []
            }
            
        # 3. Calculate similarities
        chunk_scores = []
        for chunk in all_chunks:
            score = cosine_similarity(query_vector, chunk.embedding)
            chunk_scores.append((score, chunk))
            
        # Sort descending and get top 3 matching chunks
        chunk_scores.sort(key=lambda x: x[0], reverse=True)
        top_matches = chunk_scores[:3]
        
        # Concatenate matched contexts
        context_blocks = []
        sources = []
        for idx, (score, chunk) in enumerate(top_matches):
            if score > 0.1: # Only accept relevant matches
                context_blocks.append(f"Source: {chunk.filename} (Chunk {chunk.chunk_index}):\n{chunk.content}")
                sources.append({
                    "filename": chunk.filename,
                    "chunk": chunk.chunk_index,
                    "relevance_score": round(score, 3)
                })

        if not context_blocks:
             return {
                "answer": "I couldn't find any relevant sections in the uploaded documents to answer your question.",
                "sources": []
            }

        context_string = "\n\n".join(context_blocks)
        
        # 4. Generate answer using Gemini in context boundary
        prompt = f"""
        You are a helpful company knowledge base virtual assistant.
        Answer this user question using ONLY the provided verified context below.
        
        User Question: "{query_in.question}"
        
        Verified Context:
        {context_string}
        
        Rule: If the answer cannot be found in the context blocks, respond exactly with:
        "I cannot find the answer in the uploaded manuals."
        """

        answer_text = "Gemini Key is offline. Could not complete RAG query."
        if gemini_service.is_configured():
            response = gemini_service.client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2 # Low temp for strict fact compliance
                )
            )
            answer_text = response.text

        # Audit log entry
        audit = AuditLog(
            user_id=current_user.id,
            action="DOC_RAG_QUERY",
            details=f"Semantic Query: '{query_in.question}' -> Searched {len(all_chunks)} chunks, found {len(sources)} matches.",
            lineage_step="VECTOR_QUERY"
        )
        db.add(audit)
        await db.commit()

        return {
            "answer": answer_text,
            "sources": sources
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )
