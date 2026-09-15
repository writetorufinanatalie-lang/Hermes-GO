from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class Priority(str, Enum):
    urgent = "Urgent"
    important = "Important"
    response_required = "Response Required"
    low_priority = "Low Priority"

class EmailClassification(BaseModel):
    priority: Priority
    summary: str
    action_items: List[str]

class ShippingDetails(BaseModel):
    is_shipping_email: bool = Field(description="True if the email contains shipping, tracking, or delivery information for an order.")
    delivery_date: Optional[str] = Field(None, description="The expected delivery date in YYYY-MM-DD format if found in the email. Return None if not found.")

class EmailInput(BaseModel):
    subject: str
    body: str

class WorkspaceRequest(BaseModel):
    workspace_type: str

class DraftRequest(BaseModel):
    subject: str
    body: str
    tone: Optional[str] = "Professional"

class DraftResponse(BaseModel):
    draft: str

class UnsubscribeRequest(BaseModel):
    email_id: str

class SendReplyRequest(BaseModel):
    reply_body: str

class SnoozeRequest(BaseModel):
    snooze_until: str

# New Agentic workflow schemas

class AgentRunBase(BaseModel):
    status: str
    error_msg: Optional[str] = None

class AgentRunCreate(AgentRunBase):
    pass

class AgentRun(AgentRunBase):
    id: int
    user_id: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ActionProposalBase(BaseModel):
    goal: str
    action_type: str
    source_email_ids: List[str]
    evidence: str
    expected_outcome: str
    risk_level: str # 'read_only', 'reversible', 'external_side_effect'
    requires_approval: bool
    execution_state: str # 'proposed', 'approved', 'rejected', 'running', 'verified', 'failed'
    user_explanation: str

class ActionProposalCreate(ActionProposalBase):
    pass

class ActionProposal(ActionProposalBase):
    id: int
    agent_run_id: int

    class Config:
        from_attributes = True

class ActionExecutionBase(BaseModel):
    result_data: Any
    is_successful: bool

class ActionExecutionCreate(ActionExecutionBase):
    pass

class ActionExecution(ActionExecutionBase):
    id: int
    proposal_id: int
    executed_at: datetime

    class Config:
        from_attributes = True

class UserMemoryBase(BaseModel):
    memory_key: str
    memory_value: str

class UserMemoryCreate(UserMemoryBase):
    pass

class UserMemory(UserMemoryBase):
    id: int
    user_id: int
    updated_at: datetime

    class Config:
        from_attributes = True

class PlannerOutput(BaseModel):
    proposals: List[ActionProposalCreate] = Field(..., description="A list of proposed tool actions for the current triage/planning phase.")

class CalendarEventLinkBase(BaseModel):
    event_id: str
    status: str

class CalendarEventLinkCreate(CalendarEventLinkBase):
    pass

class CalendarEventLink(CalendarEventLinkBase):
    id: int
    email_id: str

    class Config:
        from_attributes = True
