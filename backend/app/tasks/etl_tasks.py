"""Celery tasks that wrap the async ETL pipeline.

The ETL service is async (uses AsyncSession), so each task runs it inside an
event loop with its own database session. Tasks are only exercised by the
worker process; when CELERY_ENABLED=false the API layer calls the ETL service
inline instead.
"""
import asyncio

from app.core.celery_app import celery_app


@celery_app.task(name="insightai.etl.process_file", bind=True, max_retries=3, default_retry_delay=30)
def process_file_etl_task(self, file_id: int) -> str:
    """Run the full ETL pipeline (validation -> cleanup -> table -> rules) for a file."""
    from app.core.database import SessionLocal
    from app.services.etl import etl_service

    async def _run() -> None:
        async with SessionLocal() as session:
            await etl_service.process_file_etl(file_id, session)

    try:
        asyncio.run(_run())
        return f"ETL completed for file {file_id}"
    except Exception as exc:
        print(f"[Celery] ETL failed for file {file_id}: {exc}")
        raise self.retry(exc=exc)
