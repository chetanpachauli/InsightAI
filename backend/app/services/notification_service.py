import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings

class NotificationService:
    def send_email_notification(self, recipient: str, subject: str, rule_name: str, table_name: str, condition: str, count: int) -> bool:
        """Send formatted HTML alert email. Falls back to mock logs if SMTP keys are absent."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            # Mock Logging
            print(f"\n[Notification Mock - EMAIL] To: {recipient}")
            print(f"Subject: {subject}")
            print(f"Details: Rule '{rule_name}' triggered on table '{table_name}'. Found {count} anomalies.")
            return True

        try:
            # Compile HTML layout
            html_template = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: bold; tracking-wider;">InsightAI System Alert</h1>
                        <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Automated Business Intelligence Engine</p>
                    </div>
                    <div style="padding: 24px; color: #1e293b;">
                        <h2 style="margin: 0 0 16px 0; color: #ef4444; font-size: 18px; border-bottom: 2px solid #f1f5f9; pb: 8px;">
                            🚨 Alert Trigger Notice
                        </h2>
                        <p style="font-size: 14px; line-height: 1.5; color: #475569;">
                            An active database monitoring threshold was matched during our data pipeline scan. Below are the key lineage and anomaly details:
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                            <tr style="background-color: #f8fafc;">
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Rule Triggered:</td>
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #0f172a;">{rule_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Dataset Source:</td>
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #0f172a; font-family: monospace;">{table_name}</td>
                            </tr>
                            <tr style="background-color: #f8fafc;">
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Trigger Logic:</td>
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #6366f1; font-weight: bold;">{condition}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Anomalies Detected:</td>
                                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #ef4444; font-weight: bold;">{count} Rows</td>
                            </tr>
                        </table>

                        <div style="text-align: center; margin-top: 32px;">
                            <a href="http://localhost:3000/dashboard" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                                Open Analytics Dashboard
                            </a>
                        </div>
                    </div>
                    <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                        This is an automated operational notification sent by InsightAI. Please do not reply to this email.
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Setup MIME message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_USER
            msg["To"] = recipient
            msg.attach(MIMEText(html_template, "html"))

            # Dispatch SMTP Mail
            with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, recipient, msg.as_string())
            
            print(f"[Notification Success] Sent Alert email to {recipient}")
            return True
        except Exception as err:
            print(f"[Notification Failed] Error sending SMTP email to {recipient}: {str(err)}")
            return False

    def send_whatsapp_notification(self, recipient: str, message: str) -> bool:
        """Send WhatsApp message using Twilio API sandbox. Falls back to mock logs if credentials are absent."""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            # Mock Logging
            print(f"\n[Notification Mock - WHATSAPP] To: {recipient}")
            print(f"Message Body:\n{message}")
            return True

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            
            # Format phone number for twilio WhatsApp target (expects: whatsapp:+919999999999)
            target_phone = recipient
            if not target_phone.startswith("whatsapp:"):
                target_phone = f"whatsapp:{target_phone}"

            client.messages.create(
                body=message,
                from_=settings.TWILIO_WHATSAPP_FROM,
                to=target_phone
            )
            print(f"[Notification Success] WhatsApp sent successfully to {recipient}")
            return True
        except Exception as err:
            print(f"[Notification Failed] Error sending Twilio WhatsApp to {recipient}: {str(err)}")
            return False

    def send_generic_email(self, recipient: str, subject: str, message: str) -> bool:
        """Send a generic HTML formatted email. Falls back to mock logs if SMTP keys are absent."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            print(f"\n[Notification Mock - GENERIC EMAIL] To: {recipient}")
            print(f"Subject: {subject}")
            print(f"Message: {message}")
            return True

        try:
            formatted_message = message.replace("\n", "<br>")
            html_template = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                    <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: bold; tracking-wider;">InsightAI System Notification</h1>
                    </div>
                    <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                        <p style="font-size: 14px; color: #334155;">
                            {formatted_message}
                        </p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                        This notification was manually dispatched from the InsightAI Console.
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_USER
            msg["To"] = recipient
            msg.attach(MIMEText(html_template, "html"))

            with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, recipient, msg.as_string())
            
            print(f"[Notification Success] Sent generic email to {recipient}")
            return True
        except Exception as err:
            print(f"[Notification Failed] Error sending generic email to {recipient}: {str(err)}")
            return False

notification_service = NotificationService()
