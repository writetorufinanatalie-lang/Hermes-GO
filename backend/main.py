import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load API key from .env, no matter where this script is run from
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

# Allow HTTP redirect for local OAuth testing
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from database import init_db
from routers import auth, emails, agent

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Hermes GO API", lifespan=lifespan)

# Enable CORS for the Next.js frontend
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(emails.router)
app.include_router(agent.router)

@app.get("/")
def read_root():
    return {"message": "Hermes GO backend is running"}