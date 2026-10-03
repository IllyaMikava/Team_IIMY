"""Settings, read once from backend/.env (see .env.example)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "").strip()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()

MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.75"))
MAX_EMAILS = int(os.getenv("MAX_EMAILS", "5"))

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS", "").strip()
# Google shows app passwords as "xxxx xxxx xxxx xxxx"; SMTP wants it without spaces.
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
