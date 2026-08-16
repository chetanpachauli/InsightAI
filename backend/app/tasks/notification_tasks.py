"""Celery tasks for outbound notifications (email / WhatsApp / webhooks).

These are fire-and-forget deliveries dispatched from the rule engine. When
CELERY_ENABLED=false the API layer calls the notification service inline
instead, so the app still works without a worker.
"""
from app.core.celery_app import celery_app


@celery_app.task(name="insightai.notify.email_alert", bind=True, max_retries=3, default_retry_delay=60)
def send_email_alert_task(self, recipient: str, subject: str, rule_name: str,
                          table_name: str, condition: str, count: int) -> str:
    from app.services.notification_service import notification_service

    ok = notification_service.send_email_notification(
        recipient=recipient,
        subject=subject,
        rule_name=rule_name,
        table_name=table_name,
        condition=condition,
        count=count,
    )
    if not ok:
        raise self.retry()
    return f"Email alert sent to {recipient}"


@celery_app.task(name="insightai.notify.whatsapp_alert", bind=True, max_retries=3, default_retry_delay=60)
def send_whatsapp_alert_task(self, recipient: str, message: str) -> str:
    from app.services.notification_service import notification_service

    ok = notification_service.send_whatsapp_notification(recipient=recipient, message=message)
    if not ok:
        raise self.retry()
    return f"WhatsApp alert sent to {recipient}"


@celery_app.task(name="insightai.notify.generic_email", bind=True, max_retries=3, default_retry_delay=60)
def send_generic_email_task(self, recipient: str, subject: str, message: str) -> str:
    from app.services.notification_service import notification_service

    ok = notification_service.send_generic_email(recipient=recipient, subject=subject, message=message)
    if not ok:
        raise self.retry()
    return f"Generic email sent to {recipient}"


@celery_app.task(name="insightai.notify.webhook_alert", bind=True, max_retries=3, default_retry_delay=60)
def send_webhook_alert_task(self, webhook_url: str, payload: dict) -> str:
    import httpx

    try:
        resp = httpx.post(webhook_url, json=payload, timeout=5.0)
        resp.raise_for_status()
        return f"Webhook delivered to {webhook_url}"
    except Exception as exc:
        print(f"[Celery] Webhook delivery failed to {webhook_url}: {exc}")
        raise self.retry(exc=exc)
