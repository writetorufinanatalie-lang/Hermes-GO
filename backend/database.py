import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from dotenv import load_dotenv

# Load API key and database URL from .env
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

# Quote password if needed to prevent parsing errors due to special characters like '/' or '%'
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    try:
        from urllib.parse import quote_plus, unquote
        prefix = "postgresql://"
        rest = DATABASE_URL[len(prefix):]
        at_idx = rest.rfind("@")
        if at_idx != -1:
            creds = rest[:at_idx]
            host_db = rest[at_idx+1:]
            if ":" in creds:
                user, password = creds.split(":", 1)
                # Unquote first to handle any raw % symbols, then quote it correctly
                quoted_password = quote_plus(unquote(password))
                DATABASE_URL = f"postgresql://{user}:{quoted_password}@{host_db}"
    except Exception as e:
        print(f"Warning: Failed to parse and sanitize DATABASE_URL: {e}")

# Create SQLAlchemy engine
if DATABASE_URL and DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

# SessionLocal is the factory for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for models
Base = declarative_base()

def get_db():
    """FastAPI dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initializes the database schema using SQLAlchemy Base.metadata."""
    import models  # Ensure models are imported so Base metadata is populated
    print("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    print("Database schema initialized successfully.")
