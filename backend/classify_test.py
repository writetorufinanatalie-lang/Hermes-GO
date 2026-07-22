import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

sample_email = """
Subject: Final notice - payment overdue
Hi, your invoice #4521 is now 15 days overdue. 
Please pay $250 by Friday to avoid a late fee.
"""

response = client.chat.completions.create(
    model="gemini-2.0-flash",
    messages=[
        {"role": "system", "content": "Classify emails as Urgent, Important, Response Required, or Low Priority. Reply with just the label and a one-sentence reason."},
        {"role": "user", "content": sample_email}
    ]
)

print(response.choices[0].message.content)