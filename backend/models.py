from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, func, JSON
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    workspace_type = Column(String(50), default="personal")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    oauth_token = relationship("OAuthToken", back_populates="user", uselist=False, cascade="all, delete-orphan")
    emails = relationship("Email", back_populates="user", cascade="all, delete-orphan")
    agent_runs = relationship("AgentRun", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("UserMemory", back_populates="user", cascade="all, delete-orphan")

class OAuthToken(Base):
    __tablename__ = "oauth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    scopes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="oauth_token")

class Email(Base):
    __tablename__ = "emails"

    id = Column(String(255), primary_key=True, index=True) # Gmail Message ID
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(String(255), nullable=False)
    sender = Column(Text, nullable=False)
    subject = Column(Text, nullable=True)
    body = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False)

    # AI Classifications
    priority = Column(String(50), nullable=True) # Urgent, Important, Response Required, Low Priority
    summary = Column(Text, nullable=True)
    action_items = Column(JSON, default=list, nullable=True) # JSON for SQLite
    draft_reply = Column(Text, nullable=True)

    # Newsletter & Unsubscribe Info
    is_newsletter = Column(Boolean, default=False)
    list_unsubscribe_mailto = Column(Text, nullable=True)
    list_unsubscribe_url = Column(Text, nullable=True)
    is_unsubscribed = Column(Boolean, default=False)

    # Snooze Info
    snooze_until = Column(DateTime(timezone=True), nullable=True)

    # Archive (soft-delete from Hermes view)
    is_archived = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="emails")
    calendar_events = relationship("CalendarEventLink", back_populates="email", cascade="all, delete-orphan")

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="running") # running, completed, failed
    error_msg = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="agent_runs")
    proposals = relationship("ActionProposal", back_populates="agent_run", cascade="all, delete-orphan")

class ActionProposal(Base):
    __tablename__ = "action_proposals"

    id = Column(Integer, primary_key=True, index=True)
    agent_run_id = Column(Integer, ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False)
    goal = Column(Text, nullable=False)
    action_type = Column(String(100), nullable=False)
    source_email_ids = Column(JSON, default=list, nullable=False)
    evidence = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    risk_level = Column(String(50), nullable=False) # 'read_only', 'reversible', 'external_side_effect'
    requires_approval = Column(Boolean, default=True)
    execution_state = Column(String(50), default="proposed") # 'proposed', 'approved', 'rejected', 'running', 'verified', 'failed'
    user_explanation = Column(Text, nullable=True)

    # Relationships
    agent_run = relationship("AgentRun", back_populates="proposals")
    executions = relationship("ActionExecution", back_populates="proposal", cascade="all, delete-orphan")

class ActionExecution(Base):
    __tablename__ = "action_executions"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("action_proposals.id", ondelete="CASCADE"), nullable=False)
    executed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    result_data = Column(JSON, nullable=True)
    is_successful = Column(Boolean, default=False)

    # Relationships
    proposal = relationship("ActionProposal", back_populates="executions")

class UserMemory(Base):
    __tablename__ = "user_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    memory_key = Column(String(255), nullable=False, index=True)
    memory_value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="memories")

class CalendarEventLink(Base):
    __tablename__ = "calendar_event_links"

    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(String(255), ForeignKey("emails.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(String(255), nullable=False)
    status = Column(String(50), default="proposed")

    # Relationships
    email = relationship("Email", back_populates="calendar_events")

# Add explicit multi-column indexes if necessary (already defined in schema.sql)
Index("idx_emails_user_priority", Email.user_id, Email.priority)
Index("idx_emails_snooze", Email.user_id, Email.snooze_until)
Index("idx_agent_runs_user_status", AgentRun.user_id, AgentRun.status)
Index("idx_action_proposals_run_state", ActionProposal.agent_run_id, ActionProposal.execution_state)
