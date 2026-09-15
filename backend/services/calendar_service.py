import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from googleapiclient.discovery import build
import models
from routers.auth import get_google_credentials

def propose_event(db: Session, current_user: models.User, summary: str, start_time: datetime.datetime, end_time: datetime.datetime, description: str = ""):
    return {
        "status": "proposed",
        "event_details": {
            "summary": summary,
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
            "description": description
        }
    }

def create_event(db: Session, current_user: models.User, summary: str, start_time: datetime.datetime, end_time: datetime.datetime, description: str = ""):
    creds = get_google_credentials(current_user, db)
    service = build("calendar", "v3", credentials=creds)
    
    event = {
        'summary': summary,
        'description': description,
        'start': {
            'dateTime': start_time.isoformat(),
            'timeZone': 'UTC',
        },
        'end': {
            'dateTime': end_time.isoformat(),
            'timeZone': 'UTC',
        },
    }

    try:
        event = service.events().insert(calendarId='primary', body=event).execute()
        return {"status": "success", "event_id": event.get("id"), "link": event.get("htmlLink")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create calendar event: {str(e)}")
