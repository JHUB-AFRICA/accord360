"""Configurable email delivery for application notifications.

Console delivery is useful for local development, SMTP supports institutional
mail servers, and Resend supports API-based delivery without coupling the
application to a specific provider.
"""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as MimeEmailMessage
from email.utils import formataddr
from typing import Protocol

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    recipient_email: str
    recipient_name: str | None
    subject: str
    text_body: str


class EmailProvider(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailProvider:
    """Log messages instead of sending them over the network."""

    def send(self, message: EmailMessage) -> None:
        logger.info(
            "console_email to=%s subject=%s body=%s",
            message.recipient_email,
            message.subject,
            message.text_body.replace("\n", " | "),
        )


class SMTPEmailProvider:
    def send(self, message: EmailMessage) -> None:
        mime_message = MimeEmailMessage()
        mime_message["From"] = formataddr((settings.email_from_name, settings.email_from))
        mime_message["To"] = formataddr((message.recipient_name or "", message.recipient_email))
        mime_message["Subject"] = message.subject
        mime_message.set_content(message.text_body)

        smtp_class = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
        with smtp_class(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as connection:
            if settings.smtp_use_tls and not settings.smtp_use_ssl:
                connection.starttls()
            if settings.smtp_username:
                connection.login(settings.smtp_username, settings.smtp_password or "")
            connection.send_message(mime_message)


class ResendEmailProvider:
    def send(self, message: EmailMessage) -> None:
        if not settings.resend_api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")

        payload = {
            "from": formataddr((settings.email_from_name, settings.email_from)),
            "to": [message.recipient_email],
            "subject": message.subject,
            "text": message.text_body,
        }
        headers = {
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        response = httpx.post(
            settings.resend_api_url,
            json=payload,
            headers=headers,
            timeout=settings.smtp_timeout_seconds,
        )
        response.raise_for_status()


def _provider() -> EmailProvider:
    if settings.email_provider == "smtp":
        return SMTPEmailProvider()
    if settings.email_provider == "resend":
        return ResendEmailProvider()
    return ConsoleEmailProvider()


def send_notification_email(
    recipient_email: str | None,
    recipient_name: str | None,
    subject: str,
    body: str,
) -> None:
    """Send a best-effort notification email.

    Email delivery must not prevent the database notification or workflow
    transition from completing, so provider errors are logged and swallowed.
    """

    if not settings.email_enabled or not recipient_email:
        return
    try:
        _provider().send(EmailMessage(recipient_email, recipient_name, subject, body))
    except Exception:
        logger.exception("notification_email_failed recipient=%s subject=%s", recipient_email, subject)
