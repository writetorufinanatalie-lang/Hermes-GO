import base64
import requests
import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from googleapiclient.discovery import build
import models
from routers.auth import get_google_credentials

def send_reply(db: Session, current_user: models.User, email_id: str, reply_body: str):
    email_record = db.query(models.Email).filter(
        models.Email.id == email_id,
        models.Email.user_id == current_user.id
    ).first()
    
    if not email_record:
        raise HTTPException(status_code=404, detail="Email not found")
        
    creds = get_google_credentials(current_user, db)
    service = build("gmail", "v1", credentials=creds)
    
    try:
        from email.mime.text import MIMEText
        
        mime_msg = MIMEText(reply_body)
        mime_msg["to"] = email_record.sender
        mime_msg["subject"] = f"Re: {email_record.subject or ''}"
        
        raw_msg = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")
        
        body = {
            "raw": raw_msg,
            "threadId": email_record.thread_id
        }
        
        send_result = service.users().messages().send(userId="me", body=body).execute()
        
        if email_record.priority == "Response Required":
            email_record.priority = "Low Priority"
        email_record.draft_reply = reply_body
        db.commit()
        
        return {"status": "success", "message": "Reply sent successfully", "gmail_id": send_result.get("id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email reply: {str(e)}")

def snooze_email(db: Session, current_user: models.User, email_id: str, snooze_until: datetime.datetime):
    email_record = db.query(models.Email).filter(
        models.Email.id == email_id,
        models.Email.user_id == current_user.id
    ).first()

    if not email_record:
        raise HTTPException(status_code=404, detail="Email not found")

    if snooze_until.tzinfo is None:
        snooze_until = snooze_until.replace(tzinfo=datetime.timezone.utc)

    email_record.snooze_until = snooze_until
    db.commit()
    return {"status": "success", "message": f"Email snoozed until {snooze_until.isoformat()}"}

def archive_email(db: Session, current_user: models.User, email_id: str):
    email_record = db.query(models.Email).filter(
        models.Email.id == email_id,
        models.Email.user_id == current_user.id
    ).first()

    if not email_record:
        raise HTTPException(status_code=404, detail="Email not found")

    email_record.is_archived = True
    db.commit()
    return {"status": "success", "message": "Email archived"}

def unsubscribe_email(db: Session, current_user: models.User, email_id: str):
    email_record = db.query(models.Email).filter(
        models.Email.id == email_id,
        models.Email.user_id == current_user.id
    ).first()
    
    if not email_record:
        raise HTTPException(status_code=404, detail="Email not found")
    if not email_record.is_newsletter:
        raise HTTPException(status_code=400, detail="This email is not classified as a newsletter")
        
    success = False
    details = ""
    
    if email_record.list_unsubscribe_url:
        try:
            resp = requests.get(email_record.list_unsubscribe_url, timeout=10)
            if resp.status_code in [200, 201, 202, 204]:
                success = True
                details = f"HTTP Unsubscribed successfully (Status {resp.status_code})"
            else:
                details = f"HTTP request returned status {resp.status_code}"
        except Exception as e:
            details = f"HTTP unsubscribe request failed: {str(e)}"
            
    if not success and email_record.list_unsubscribe_mailto:
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(email_record.list_unsubscribe_mailto)
            to_email = parsed.path
            query = parse_qs(parsed.query)
            subject = query.get("subject", ["Unsubscribe"])[0]
            body = query.get("body", ["Please unsubscribe me from this list."])[0]
            
            creds = get_google_credentials(current_user, db)
            service = build("gmail", "v1", credentials=creds)
            
            from email.mime.text import MIMEText
            mime_msg = MIMEText(body)
            mime_msg["to"] = to_email
            mime_msg["subject"] = subject
            raw_msg = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode("utf-8")
            
            send_result = service.users().messages().send(userId="me", body={"raw": raw_msg}).execute()
            success = True
            details = f"Mailto email sent successfully to {to_email} (Msg ID: {send_result.get('id')})"
        except Exception as e:
            details += f"; Mailto failed: {str(e)}"
            
    if success:
        email_record.is_unsubscribed = True
        db.commit()
        return {"status": "success", "message": details}
    else:
        raise HTTPException(status_code=400, detail=f"Unsubscribe failed. Details: {details}")

def unarchive_email(db: Session, current_user: models.User, email_id: str):
    email_record = db.query(models.Email).filter(
        models.Email.id == email_id,
        models.Email.user_id == current_user.id
    ).first()

    if not email_record:
        raise HTTPException(status_code=404, detail="Email not found")

    email_record.is_archived = False
    db.commit()
    return {"status": "success", "message": "Email restored to inbox"}

def fetch_and_sync_emails(db: Session, current_user: models.User):
    import os
    from services.demo_seeder import seed_demo_emails_if_needed
    
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        seed_demo_emails_if_needed(db, current_user)
        
    # For now, just return emails from the DB to avoid the massive inline LLM triage block.
    # The new Agentic workflow will handle triage separately.
    now = datetime.datetime.now(datetime.timezone.utc)
    all_emails = db.query(models.Email).filter(
        models.Email.user_id == current_user.id,
        (models.Email.snooze_until == None) | (models.Email.snooze_until <= now)
    ).order_by(models.Email.received_at.desc()).all()
    
    return all_emails
