# Hermes GO: Inbox-to-Action Autopilot

**Hermes GO turns inbox overload into a safe, reviewable execution plan. It detects commitments, prioritizes work, proposes actions across Gmail and Calendar, and executes only what the user approves.**

## Architecture


Hermes GO uses an agentic workflow to process emails safely:
1. **Triage Agent**: Analyzes incoming emails to detect priorities, deadlines, and actionable items.
2. **Planner Agent**: Generates a structured execution plan (Action Proposals) based on the context.
3. **Guardian / Verifier**: Evaluates the risk of each action (Read-Only, Reversible, External Side Effect).
4. **Approval Layer**: Stops execution and waits for explicit user consent in the "Today's Plan" UI.
5. **Executor Agent**: Runs approved tools (e.g., sending replies, creating calendar events, unsubscribing).

## Features
- **Intelligent Triage**: Categorizes emails into priority buckets (e.g., Urgent, Response Required).
- **Today's Plan**: A dedicated workspace that presents proposed actions with evidence and expected outcomes.
- **Google Calendar Integration**: Automatically proposes calendar events (study blocks, meetings) based on email context.
- **Safe Execution**: Risk badges visually indicate the potential impact of an action. No destructive actions or external side effects occur without explicit user approval.
- **Relational Memory**: Learns user preferences over time to tailor responses and scheduling.
- **Demo Mode**: Built-in seeded mock data for seamless presentations.

## Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- Google Cloud Console Project with Gmail API and Google Calendar API enabled.
- Gemini API Key.

### Backend Setup
1. Navigate to the `backend/` directory.
2. Create a virtual environment: `python -m venv venv` and activate it.
3. Install dependencies: `pip install -r requirements.txt` (ensure FastAPI, SQLAlchemy, instructor, google-auth, etc., are installed).   ```
4. Run the backend: `uvicorn main:app --reload` (Runs on port 8000).

### Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install dependencies: `npm install`.
3. Run the frontend: `npm run dev` (Runs on port 3000).

## Demo Mode
To easily demonstrate the product without connecting a live Gmail account, enable Demo Mode:
1. Set `DEMO_MODE=true` in `backend/.env`.
2. Restart the backend server.
3. In the frontend, click "Login with Google" (OAuth will be instantly bypassed).
4. The database will be seeded with 15 mock emails containing invoices, meeting requests, and newsletters.

## Security & Approval Model
Hermes GO operates on a "Human-in-the-loop" default. The Planner Agent proposes actions, but the Executor is physically gated by the database `execution_state`. External actions (like sending emails) are strictly marked as `requires_approval=True`.

# Hermes-GO
Hermes GO is an app that can classify your emails on the basis of urgency. It will summarize long emails and remind you when responses are due. It can even generate responses for emails that require them.

