import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from enum import Enum
import instructor
from openai import OpenAI

# Load API key from .env, no matter where this script is run from
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# --- Set up the Gemini client, wrapped with Instructor for structured output ---
base_client = OpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
client = instructor.from_openai(base_client)

app = FastAPI()

# --- Define the shape of data going IN (what the frontend sends us) ---
class EmailInput(BaseModel):
    subject: str
    body: str

# --- Define the shape of data coming OUT (what we send back to the frontend) ---
class Priority(str, Enum):
    urgent = "Urgent"
    important = "Important"
    response_required = "Response Required"
    low_priority = "Low Priority"

class EmailClassification(BaseModel):
    priority: Priority
    summary: str
    action_items: list[str]

# --- The actual endpoint ---
@app.post("/classify", response_model=EmailClassification)
def classify_email(email: EmailInput):
    result = client.chat.completions.create(
        model="gemini-3.5-flash",
        response_model=EmailClassification,
        messages=[
            {
                "role": "system",
                "content": (
                    "You classify emails into one of: Urgent, Important, "
                    "Response Required, or Low Priority. You also write a "
                    "1-2 sentence summary and extract any clear action items "
                    "(tasks, deadlines, requests). If there are none, return an empty list."
                )
            },
            {
                "role": "user",
                "content": f"Subject: {email.subject}\n\nBody: {email.body}"
            }
        ]
    )
    return result

# --- A simple health check, so you can confirm the server is alive ---
@app.get("/")
def read_root():
    return {"message": "Hermes GO backend is running"}