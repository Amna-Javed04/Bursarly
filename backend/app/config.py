import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Bursarly API"
    API_V1_STR: str = "/api/v1"

    # Database Settings
    # Default to local SQLite database with absolute path for reliable resolution across CWDs
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///c:/Users/amnaa/Desktop/Bursarly/backend/bursarly.db")


    # CORS Settings
    # We restrict CORS to specific domains as required (defaulting to local frontend port for development)
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Security
    ADMIN_API_KEY: str = "admin-secret-key-change-in-production"

    # Supabase Auth Settings (for JWT verification)
    # These are required for production. Leave empty for SQLite/local dev (mock auth is used).
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # JWT secret from Supabase project: Settings → API → JWT Secret
    SUPABASE_JWT_SECRET: str = ""

    # Rate limiting: requests per minute for auth endpoints
    AUTH_RATE_LIMIT: str = "10/minute"
    LOGIN_RATE_LIMIT: str = "5/minute"

    # Chatbot Settings & Rate Limiting
    # A chat conversation easily exceeds 5 messages, so the anonymous budget is
    # generous enough to finish a conversation without 429s.
    CHAT_ANONYMOUS_RATE_LIMIT: str = "20/minute"
    CHAT_AUTH_RATE_LIMIT: str = "20/minute"

    # LLM API Keys (OpenAI or Gemini) & Search API (Tavily)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
