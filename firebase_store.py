from __future__ import annotations

import os
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore


def _candidate_credential_paths() -> list[str]:
    candidates = [
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"),
        os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH"),
        os.path.join(os.path.dirname(__file__), "service_account.json"),
        os.path.join(os.path.dirname(__file__), "firebase-adminsdk.json"),
        os.path.join(os.path.dirname(__file__), "service_account.private.json"),
    ]
    return [path for path in candidates if path and os.path.exists(path)]


@lru_cache(maxsize=1)
def get_firestore_client():
    if not firebase_admin._apps:
        credential_path = next(iter(_candidate_credential_paths()), None)
        if credential_path:
            firebase_admin.initialize_app(credentials.Certificate(credential_path))
        else:
            raise RuntimeError(
                "Firestore credentials are not configured. Set GOOGLE_APPLICATION_CREDENTIALS "
                "or FIREBASE_SERVICE_ACCOUNT_PATH to a valid service account JSON file."
            )
    return firestore.client()


def utc_now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)
