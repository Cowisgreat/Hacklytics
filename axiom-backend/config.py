"""
Axiom Configuration
Loads from .env file with sensible defaults for hackathon demo mode.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./axiom.db")
    ACTIAN_VECTORAI_HOST = os.getenv("ACTIAN_VECTORAI_HOST", "localhost")
    ACTIAN_VECTORAI_PORT = int(os.getenv("ACTIAN_VECTORAI_PORT", "5432"))
    ACTIAN_VECTORAI_DB = os.getenv("ACTIAN_VECTORAI_DB", "vectorai")
    ACTIAN_VECTORAI_USER = os.getenv("ACTIAN_VECTORAI_USER", "postgres")
    ACTIAN_VECTORAI_PASSWORD = os.getenv("ACTIAN_VECTORAI_PASSWORD", "postgres")

    # LLM
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

    # Sphinx
    SPHINX_API_URL = os.getenv("SPHINX_API_URL", "https://api.sphinx.ai/v1")
    SPHINX_API_KEY = os.getenv("SPHINX_API_KEY", "")

    # Embedding
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # Risk thresholds
    RISK_THRESHOLD_ALLOW = float(os.getenv("RISK_THRESHOLD_ALLOW", "0.80"))
    RISK_THRESHOLD_REWRITE = float(os.getenv("RISK_THRESHOLD_REWRITE", "0.40"))

    # Demo mode — uses pre-baked data instead of live API calls
    DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"


config = Config()
