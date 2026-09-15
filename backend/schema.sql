-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OAuth Tokens Table (one per user)
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Emails Table
CREATE TABLE IF NOT EXISTS emails (
    id VARCHAR(255) PRIMARY KEY, -- Gmail Message ID
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    thread_id VARCHAR(255) NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- AI Classifications
    priority VARCHAR(50), -- Urgent, Important, Response Required, Low Priority
    summary TEXT,
    action_items JSONB DEFAULT '[]'::jsonb,
    draft_reply TEXT,
    
    -- Newsletter & Unsubscribe Info
    is_newsletter BOOLEAN DEFAULT FALSE,
    list_unsubscribe_mailto TEXT,
    list_unsubscribe_url TEXT,
    is_unsubscribed BOOLEAN DEFAULT FALSE,
    
    -- Snooze & Archive Info
    snooze_until TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_emails_user_priority ON emails(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_emails_snooze ON emails(user_id, snooze_until);
