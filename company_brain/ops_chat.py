from __future__ import annotations

from typing import List, Dict, Any, Optional
from firebase_store import get_firestore_client, utc_now


def save_chat_conversation(messages: List[Dict[str, Any]], user_id: Optional[str] = None, session_id: Optional[str] = None) -> str:
    """Persist a full conversation to Firestore and return the doc id."""
    db = get_firestore_client()
    coll = db.collection('ops_chats')

    payload = {
        'user_id': user_id or None,
        'session_id': session_id or None,
        'messages': [
            {
                'role': m.get('role'),
                'content': m.get('content'),
                'created_at': m.get('timestamp') if m.get('timestamp') else utc_now(),
            }
            for m in messages
        ],
        'created_at': utc_now(),
        'updated_at': utc_now(),
    }

    doc_ref = coll.document()
    doc_ref.set(payload)
    return doc_ref.id


def append_chat_messages(chat_doc_id: str, messages: List[Dict[str, Any]]) -> None:
    db = get_firestore_client()
    doc_ref = db.collection('ops_chats').document(chat_doc_id)
    batch = db.batch()
    # Append messages using arrayUnion
    from firebase_admin import firestore as _fs

    for m in messages:
        msg_payload = {
            'role': m.get('role'),
            'content': m.get('content'),
            'created_at': m.get('timestamp') if m.get('timestamp') else utc_now(),
        }
        batch.update(doc_ref, {'messages': _fs.ArrayUnion([msg_payload]), 'updated_at': utc_now()})

    batch.commit()


def get_chat_history_for_user(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    db = get_firestore_client()
    # Firestore python client uses ASCENDING/DESCENDING constants
    from firebase_admin import firestore as _fs
    q = db.collection('ops_chats').where('user_id', '==', user_id).order_by('created_at', direction=_fs.Query.DESCENDING).limit(limit)
    docs = q.stream()
    out = []
    for d in docs:
        data = d.to_dict()
        out.append({'id': d.id, 'data': data})
    return out
