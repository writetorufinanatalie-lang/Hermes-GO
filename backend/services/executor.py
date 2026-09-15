from pydantic import BaseModel
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
import datetime

from services.gmail_service import send_reply, snooze_email, archive_email, unsubscribe_email
from services.calendar_service import create_event, propose_event
import models

class ActionProposal(BaseModel):
    action_type: str  # e.g., 'send_reply', 'snooze', 'archive', 'unsubscribe', 'create_event', 'propose_event'
    parameters: Dict[str, Any]

def execute_action(db: Session, current_user: models.User, proposal: ActionProposal):
    action = proposal.action_type
    params = proposal.parameters

    if action == "send_reply":
        return send_reply(
            db=db, 
            current_user=current_user, 
            email_id=params["email_id"], 
            reply_body=params["reply_body"]
        )
    elif action == "snooze":
        snooze_dt = datetime.datetime.fromisoformat(params["snooze_until"])
        return snooze_email(
            db=db,
            current_user=current_user,
            email_id=params["email_id"],
            snooze_until=snooze_dt
        )
    elif action == "archive":
        return archive_email(
            db=db,
            current_user=current_user,
            email_id=params["email_id"]
        )
    elif action == "unsubscribe":
        return unsubscribe_email(
            db=db,
            current_user=current_user,
            email_id=params["email_id"]
        )
    elif action == "create_event":
        start_dt = datetime.datetime.fromisoformat(params["start_time"])
        end_dt = datetime.datetime.fromisoformat(params["end_time"])
        return create_event(
            db=db,
            current_user=current_user,
            summary=params["summary"],
            start_time=start_dt,
            end_time=end_dt,
            description=params.get("description", "")
        )
    elif action == "propose_event":
        start_dt = datetime.datetime.fromisoformat(params["start_time"])
        end_dt = datetime.datetime.fromisoformat(params["end_time"])
        return propose_event(
            db=db,
            current_user=current_user,
            summary=params["summary"],
            start_time=start_dt,
            end_time=end_dt,
            description=params.get("description", "")
        )
    else:
        raise ValueError(f"Unknown action_type: {action}")
