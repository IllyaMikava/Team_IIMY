"""One email per match via Gmail SMTP — or MOCK mode (print to console) when Gmail isn't configured."""
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage

from . import config
from .models import MatchResult

log = logging.getLogger("internmatch.email")

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def is_mock_mode() -> bool:
    return not (config.GMAIL_ADDRESS and config.GMAIL_APP_PASSWORD)


def build_message(to_email: str, match: MatchResult) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = f"You matched: {match.job_title} at {match.company}"
    msg["From"] = f"InternMatch AI <{config.GMAIL_ADDRESS or 'no-reply@internmatch.local'}>"
    msg["To"] = to_email

    lines = [
        "Hi there,",
        "",
        f"Good news: your CV is a strong match for {match.job_title} at {match.company}"
        + (f" ({match.location})." if match.location else "."),
    ]
    if match.match_reason:
        lines += ["", f"Why you matched: {match.match_reason}"]
    lines += ["", f"Next step: {match.next_step}"]
    if match.url:
        lines += ["", f"View the job: {match.url}"]
    lines += ["", "— InternMatch AI"]
    msg.set_content("\n".join(lines))

    e = html.escape
    reason_html = f'<p style="color:#4f46e5;margin:0 0 16px">{e(match.match_reason)}</p>' if match.match_reason else ""
    link_html = f'<p><a href="{e(match.url)}" style="color:#4f46e5">View the job →</a></p>' if match.url else ""
    msg.add_alternative(
        f"""\
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;color:#111827;line-height:1.5">
  <p>Hi there,</p>
  <p>Good news: your CV is a strong match for <strong>{e(match.job_title)}</strong> at
     <strong>{e(match.company)}</strong>{f" ({e(match.location)})" if match.location else ""}.</p>
  {reason_html}
  <div style="background:#eef2ff;border-radius:10px;padding:12px 16px;margin:0 0 16px">
    <strong>Next step:</strong> {e(match.next_step)}
  </div>
  {link_html}
  <p style="color:#6b7280">— InternMatch AI</p>
</div>""",
        subtype="html",
    )
    return msg


def send_match_email(to_email: str, match: MatchResult) -> bool:
    """Send (or mock) one match email. Never raises; returns True on success."""
    msg = build_message(to_email, match)

    if is_mock_mode():
        log.info(
            "MOCKED email (set GMAIL_ADDRESS + GMAIL_APP_PASSWORD to really send)\n"
            "  To: %s\n  Subject: %s\n%s",
            to_email,
            msg["Subject"],
            "\n".join("  | " + line for line in msg.get_body(("plain",)).get_content().splitlines()),
        )
        return True

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context(), timeout=20) as smtp:
            smtp.login(config.GMAIL_ADDRESS, config.GMAIL_APP_PASSWORD)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        log.error("Email FAILED to %s (%s): %s", to_email, msg["Subject"], exc)
        return False

    log.info("SENT email to %s: %s", to_email, msg["Subject"])
    return True
