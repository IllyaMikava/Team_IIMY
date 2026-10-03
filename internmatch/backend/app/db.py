"""MongoDB Atlas connection + collection helpers."""
from functools import lru_cache

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from . import config

DB_NAME = "internmatch"


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    """One shared client for the whole process (pymongo pools connections itself)."""
    if not config.MONGODB_URI:
        raise RuntimeError("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.")
    # tz_aware: return datetimes as UTC-aware, so the API sends "...+00:00" and browsers show the right local time.
    return MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=10_000, appname="internmatch", tz_aware=True)


def get_db() -> Database:
    return get_client()[DB_NAME]


def listings() -> Collection:
    """Job descriptions, each with an `embedding` and a predefined `next_step`."""
    return get_db()["listings"]


def match_events() -> Collection:
    """Audit log: one record per match shown/emailed to a candidate."""
    return get_db()["match_events"]
