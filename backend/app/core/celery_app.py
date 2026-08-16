"""Celery application instance.

Broker/backend default to Redis. The worker is only required when
CELERY_ENABLED=true (production); when disabled, endpoints fall back to
inline execution so the app works without a broker.
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "insightai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.etl_tasks",
        "app.tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
)
