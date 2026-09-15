import os
import instructor
import google.generativeai as genai
from typing import List, Optional

import models
import schemas
from prompts.planner import PLANNER_SYSTEM_PROMPT

def generate_plan(emails: List[models.Email], user_memories: Optional[List[models.UserMemory]] = None) -> schemas.PlannerOutput:
    """
    Takes a list of Email records and optional UserMemory context,
    uses the instructor library with Gemini (gemini-3.5-flash) to generate a PlannerOutput.
    """
    
    # Configure Gemini
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        genai.configure(api_key=api_key)
        
    client = instructor.from_gemini(
        client=genai.GenerativeModel(model_name="models/gemini-3.5-flash"),
        mode=instructor.Mode.GEMINI_JSON,
    )
    
    # Prepare the context
    email_context = "\n\n".join([
        f"Email ID: {getattr(email, 'id', 'N/A')}\n"
        f"Subject: {getattr(email, 'subject', 'N/A')}\n"
        f"Body: {getattr(email, 'body', 'N/A')}" 
        for email in emails
    ])
    
    memory_context = ""
    if user_memories:
        memory_context = "User Memory Context:\n" + "\n".join([
            f"- {getattr(mem, 'memory_key', 'N/A')}: {getattr(mem, 'memory_value', 'N/A')}" 
            for mem in user_memories
        ])
    
    prompt = f"{memory_context}\n\nHere are the emails to process:\n{email_context}\n\nPlease generate an action plan based on these emails."
    
    # Call the model via instructor (using standard chat completions interface it emulates)
    resp = client.chat.completions.create(
        messages=[
            {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        response_model=schemas.PlannerOutput,
    )
    
    return resp
