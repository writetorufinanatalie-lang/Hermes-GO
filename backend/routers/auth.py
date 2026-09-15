import os
import datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2 import id_token
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from jose import jwt, JWTError
from typing import Optional

import models
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid"
]

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        user_id = payload.get("user_id")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid session token")

def get_google_credentials(user: models.User, db: Session):
    token_record = user.oauth_token
    if not token_record:
        raise HTTPException(status_code=400, detail="User has not authorized with Google")
    
    creds = Credentials(
        token=token_record.access_token,
        refresh_token=token_record.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        scopes=token_record.scopes.split(" ") if token_record.scopes else []
    )
    
    now = datetime.datetime.now(datetime.timezone.utc)
    
    expires_at = token_record.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
        
    if expires_at <= now or not creds.valid:
        print(f"Refreshing Google access token for user: {user.email}")
        try:
            creds.refresh(GoogleRequest())
            token_record.access_token = creds.token
            token_record.expires_at = creds.expiry
            db.commit()
        except Exception as e:
            print(f"Error refreshing Google token: {e}")
            raise HTTPException(status_code=401, detail="Google authentication expired, please sign in again")
            
    return creds

@router.get("/login")
def auth_login():
    if os.getenv("DEMO_MODE", "false").lower() == "true":
        # Redirect directly to callback with a fake code for demo mode
        redirect_uri = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
        return {"url": f"{redirect_uri}?code=demo_mode_bypass"}
        
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=os.getenv("REDIRECT_URI"),
        autogenerate_code_verifier=False
    )
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"
    )
    return {"url": authorization_url}

@router.get("/callback")
def auth_callback(code: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    if error or not code:
        err_msg = error or "Authentication cancelled"
        from urllib.parse import quote_plus
        return RedirectResponse(url=f"{frontend_url}/?error={quote_plus(err_msg)}")
        
    try:
        email = None
        name = None
        
        if code == "demo_mode_bypass" and os.getenv("DEMO_MODE", "false").lower() == "true":
            email = "demo.user@example.com"
            name = "Demo User"
        else:
            client_config = {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/v2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            }
            flow = Flow.from_client_config(
                client_config,
                scopes=SCOPES,
                redirect_uri=os.getenv("REDIRECT_URI"),
                autogenerate_code_verifier=False
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            if credentials.id_token:
                try:
                    id_info = id_token.verify_oauth2_token(
                        credentials.id_token,
                        GoogleRequest(),
                        os.getenv("GOOGLE_CLIENT_ID")
                    )
                    email = id_info.get("email")
                    name = id_info.get("name")
                except Exception as e_id:
                    print(f"ID token verification warning: {e_id}")

            if not email:
                userinfo_service = build("oauth2", "v2", credentials=credentials)
                user_info = userinfo_service.userinfo().get().execute()
                email = user_info.get("email")
                name = user_info.get("name")

            if not email:
                raise Exception("Unable to retrieve account email address from Google.")
                
            name = name or email.split("@")[0]
            
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(email=email, name=name)
            db.add(user)
            db.commit()
            db.refresh(user)
            
        if code != "demo_mode_bypass":
            token_record = db.query(models.OAuthToken).filter(models.OAuthToken.user_id == user.id).first()
            
            if credentials.expiry:
                expires_at = credentials.expiry
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=datetime.timezone.utc)
            else:
                expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
                
            scopes_str = " ".join(credentials.scopes) if credentials.scopes else ""
            
            if not token_record:
                token_record = models.OAuthToken(
                    user_id=user.id,
                    access_token=credentials.token,
                    refresh_token=credentials.refresh_token,
                    expires_at=expires_at,
                    scopes=scopes_str
                )
                db.add(token_record)
            else:
                token_record.access_token = credentials.token
                if credentials.refresh_token:
                    token_record.refresh_token = credentials.refresh_token
                token_record.expires_at = expires_at
                token_record.scopes = scopes_str
            db.commit()
        
        token_data = {"user_id": user.id, "email": user.email}
        session_token = jwt.encode(token_data, os.getenv("JWT_SECRET"), algorithm="HS256")
        
        redirect_to = f"{frontend_url}/auth-callback?token={session_token}&email={user.email}&name={name}"
        return RedirectResponse(url=redirect_to)
    except Exception as e:
        import traceback
        from urllib.parse import quote_plus
        traceback.print_exc()
        print(f"OAuth Callback Error: {e}")
        err_msg = quote_plus(str(e))
        return RedirectResponse(url=f"{frontend_url}/?error={err_msg}")
