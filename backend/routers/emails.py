import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

import models
from database import get_db
from routers.auth import get_current_user
from services.gmail_service import fetch_and_sync_emails, unsubscribe_email, archive_email, unarchive_email, snooze_email, send_reply

router = APIRouter(prefix="/emails", tags=["emails"])

class UnsubscribeRequest(BaseModel):
    email_id: str

class SnoozeRequest(BaseModel):
    snooze_until: str

class SendReplyRequest(BaseModel):
    reply_body: str

@router.get("")
def get_emails(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # This should call a sync function in gmail_service, but to keep it simple and reuse existing logic,
    # I will rely on fetch_and_sync_emails (which we need to make sure exists in gmail_service).
    # Assuming gmail_service.py implemented it, or we implement the sync logic directly.
    return fetch_and_sync_emails(db, current_user)

@router.post("/{email_id}/unsubscribe")
def unsubscribe(email_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return unsubscribe_email(db, current_user, email_id)

@router.post("/{email_id}/archive")
def archive(email_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return archive_email(db, current_user, email_id)

@router.post("/{email_id}/unarchive")
def unarchive(email_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return unarchive_email(db, current_user, email_id)

@router.post("/{email_id}/snooze")
def snooze(email_id: str, req: SnoozeRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    snooze_dt = datetime.datetime.fromisoformat(req.snooze_until)
    if snooze_dt.tzinfo is None:
        snooze_dt = snooze_dt.replace(tzinfo=datetime.timezone.utc)
    return snooze_email(db, current_user, email_id, snooze_dt)

@router.post("/{email_id}/send-reply")
def send_reply_route(email_id: str, req: SendReplyRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return send_reply(db, current_user, email_id, req.reply_body)
