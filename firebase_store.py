from __future__ import annotations

import json
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
        # ── Priority 1: JSON string injected as a secret env var (Cloud Run / CI)
        json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        if json_str:
            try:
                service_account_info = json.loads(json_str)
                cred = credentials.Certificate(service_account_info)
                firebase_admin.initialize_app(cred)
            except Exception as exc:
                raise RuntimeError(
                    f"FIREBASE_SERVICE_ACCOUNT_JSON is set but could not be parsed: {exc}"
                ) from exc
        else:
            # ── Priority 2: File path on disk (local dev / bundled file)
            credential_path = next(iter(_candidate_credential_paths()), None)
            if credential_path:
                firebase_admin.initialize_app(credentials.Certificate(credential_path))
            else:
                raise RuntimeError(
                    "Firestore credentials are not configured.\n"
                    "Options:\n"
                    "  1. Set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON string (recommended for Cloud Run)\n"
                    "  2. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_PATH to a JSON file path\n"
                    "  3. Place service_account.json next to this file"
                )
    return firestore.client()


def utc_now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)
