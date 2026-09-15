# Hermes GO: Inbox-to-Action Autopilot

**Hermes GO turns inbox overload into a safe, reviewable execution plan. It detects commitments, prioritizes work, proposes actions across Gmail and Calendar, and executes only what the user approves.**

## Architecture

![Architecture](https://via.placeholder.com/800x400?text=Hermes+GO+Architecture)

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
3. Install dependencies: `pip install -r requirements.txt` (ensure FastAPI, SQLAlchemy, instructor, google-auth, etc., are installed).
4. Copy `.env.example` to `.env` and fill in your credentials:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GEMINI_API_KEY=your_gemini_key_here
   JWT_SECRET=your_random_jwt_secret
   REDIRECT_URI=http://localhost:8000/auth/callback
   FRONTEND_URL=http://localhost:3000
   DEMO_MODE=false
   ```
5. Run the backend: `uvicorn main:app --reload` (Runs on port 8000).

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

### 90-Second Hackathon Demo Script
1. **Open the seeded inbox**: Log in using Demo Mode to show a realistic, cluttered inbox.
2. **Show Today’s Plan**: Navigate to the "Today's Plan" tab. Highlight how the Autopilot has already extracted deadlines and generated action proposals.
3. **Examine Evidence**: Open an assignment email proposal and show the evidence-based deadline extraction.
4. **Approve Actions**: Click "Approve" on a calendar study block and a draft reply proposal.
5. **Execute and Verify**: Click "Execute" on the approved items and show the verified execution receipts in the Agent Activity timeline.
6. **Clean Up**: Show the newsletter cleanup proposal and shipping snooze action, emphasizing that the system correctly flagged them and waited for approval before taking external action.

## Security & Approval Model
Hermes GO operates on a "Human-in-the-loop" default. The Planner Agent proposes actions, but the Executor is physically gated by the database `execution_state`. External actions (like sending emails) are strictly marked as `requires_approval=True`.

## Evaluation
The project includes a seeded fixture set in `demo_seeder.py` to evaluate the extraction accuracy, plan acceptance rate, and tool success rate of the agentic workflow.