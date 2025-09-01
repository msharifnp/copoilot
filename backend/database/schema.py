from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum
# from __future__ import annotations
from pathlib import Path
import os


# Enums
class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class SupportedLanguage(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    CPP = "cpp"
    CSHARP = "csharp"
    GO = "go"
    RUST = "rust"
    PHP = "php"
    RUBY = "ruby"
    SQL = "sql"
    C = "c"
    SWIFT = "swift"
    SCALA = "scala"
    HTML = "html"
    CSS = "css"
    KOTLIN = "kotlin"
    DART = "dart"
    
EXTENSION_LANGUAGE : Dict[str, SupportedLanguage] = {
    ".py": SupportedLanguage.PYTHON,
    ".js": SupportedLanguage.JAVASCRIPT,
    ".ts": SupportedLanguage.TYPESCRIPT,
    ".java": SupportedLanguage.JAVA,
    ".cpp": SupportedLanguage.CPP,
    ".cc": SupportedLanguage.CPP,
    ".cxx": SupportedLanguage.CPP,
    ".c": SupportedLanguage.C,
    ".cs": SupportedLanguage.CSHARP,
    ".go": SupportedLanguage.GO,
    ".rs": SupportedLanguage.RUST,
    ".php": SupportedLanguage.PHP,
    ".rb": SupportedLanguage.RUBY,
    ".sql": SupportedLanguage.SQL,
    ".swift": SupportedLanguage.SWIFT,
    ".scala": SupportedLanguage.SCALA,
    ".html": SupportedLanguage.HTML,
    ".css": SupportedLanguage.CSS,
    ".kotlin": SupportedLanguage.KOTLIN,
    ".dart": SupportedLanguage.DART
}

def detect_language_from_filename(filename: str) -> Optional[SupportedLanguage]:
    _, ext = os.path.splitext(filename.lower())
    return EXTENSION_LANGUAGE.get(ext)

class RequestSource(str, Enum):
    API = "api"
    AUTOCOMPLETE = "autocomplete"

class SessionStatus(str, Enum):
    ACTIVE = "active"      # currently in Redis cache
    ARCHIVED = "archived"  # saved to DB only
    LOADED = "loaded"      # loaded from DB into cache


# Base
class TimestampedModel(BaseModel):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Chat: runtime requests (cache-first flow)
class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000, description="Chat message text")
    session_id: str = Field(..., max_length=255, description="Chat session identifier")
    user_id: str = Field(..., max_length=50, description="User identifier")
    timestamp: Optional[str] = None
    source: Optional[RequestSource] = RequestSource.API
    metadata: Optional[Dict[str, Any]] = None

    @field_validator("text")
    @classmethod
    def _non_empty_text(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Message text cannot be empty")
        return v.strip()

# Session lifecycle
class StartChatRequest(BaseModel):
    user_id: str = Field(..., max_length=50, description="User identifier")
    session_id: Optional[str] = Field(None, max_length=255, description="Optional custom session ID")
    initial_message: Optional[str] = Field(None, max_length=1000, description="Optional first message")
    metadata: Optional[Dict[str, Any]] = None

class LoadChatRequest(BaseModel):
    session_id: str = Field(..., max_length=255, description="Session ID to load")
    user_id: str = Field(..., max_length=50, description="User identifier")

class CloseChatRequest(BaseModel):
    session_id: str = Field(..., max_length=255, description="Session ID to close")
    user_id: str = Field(..., max_length=50, description="User identifier")
    save_to_database: bool = Field(default=True, description="Whether to save to database")


# Code completion
# class CodeCompletionRequest(BaseModel):
#     text: str = Field(..., min_length=1, max_length=2000, description="Code context")
#     session_id: Optional[str] = Field(default="code_completion", max_length=255)
#     user_id: str = Field(..., max_length=50, description="User identifier")
#     source: Optional[RequestSource] = RequestSource.AUTOCOMPLETE
#     language: Optional[SupportedLanguage] = None
#     file_path: Optional[str] = Field(None, max_length=500)
#     cursor_position: Optional[Dict[str, int]] = Field(None, description="Cursor line/column position")
#     context: Optional[Dict[str, Any]] = Field(None, description="Before/after code context")

#     @field_validator("text")
#     @classmethod
#     def _non_empty_code(cls, v: str) -> str:
#         if not v or not v.strip():
#             raise ValueError("Code text cannot be empty")
#         return v.strip()

#     @field_validator("file_path", mode="after")
#     @classmethod
#     def _set_language_from_extension(cls, v: Optional[str], values: Dict[str, Any]) -> Optional[str]:
#         if v:
#             ext = os.path.splitext(v)[1].lower()
#             if ext in EXTENSION_LANGUAGE:
#                 values["language"] = EXTENSION_LANGUAGE[ext]
#         return v

class CodeCompletionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="Code context")
    session_id: Optional[str] = Field(default="code_completion", max_length=255)
    user_id: str = Field(..., max_length=50, description="User identifier")
    source: Optional[str] = Field(default="autocomplete")
    language: Optional[SupportedLanguage] = None
    file_path: Optional[str] = Field(None, max_length=500)
    cursor_position: Optional[Dict[str, int]] = Field(None, description="Cursor line/column position")
    context: Optional[Dict[str, Any]] = Field(None, description="Before/after code context")

    @field_validator("text")
    @classmethod
    def _non_empty_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Code text cannot be empty")
        return v.strip()

    @model_validator(mode="before")
    @classmethod
    def _set_language_from_extension(cls, data: Any) -> Any:
        """
        Pydantic v2: mutate the incoming dict here (before field parsing).
        We cannot set other fields from a field_validator.
        """
        if isinstance(data, dict) and not data.get("language"):
            fp = data.get("file_path")
            if fp:
                mapped = detect_language_from_filename(fp)
                if mapped:
                    data["language"] = mapped
        return data

# Responses

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI generated response")
    message_count: int = Field(..., description="Total messages in session")
    session_id: str = Field(..., description="Session identifier")
    user_id: str = Field(..., description="User identifier")
    session_status: SessionStatus = Field(..., description="Current session status")
    model_used: str = Field(default="gemini-1.5-pro", description="AI model used")
    processing_time_ms: Optional[int] = Field(None, description="Processing time in milliseconds")
    metadata: Optional[Dict[str, Any]] = None
    in_cache: bool = Field(..., description="Whether session is currently in Redis cache")

class StartChatResponse(BaseModel):
    session_id: str = Field(..., description="New session identifier")
    user_id: str = Field(..., description="User identifier")
    status: SessionStatus = Field(default=SessionStatus.ACTIVE, description="Session status")
    message: str = Field(..., description="Status message")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LoadChatResponse(BaseModel):
    session_id: str = Field(..., description="Loaded session identifier")
    user_id: str = Field(..., description="User identifier")
    message_count: int = Field(..., description="Number of messages loaded")
    status: SessionStatus = Field(default=SessionStatus.LOADED, description="Session status")
    message: str = Field(..., description="Status message")
    last_updated: Optional[datetime] = Field(None, description="When session was last updated")

class CloseChatResponse(BaseModel):
    session_id: str = Field(..., description="Closed session identifier")
    user_id: str = Field(..., description="User identifier")
    message_count: int = Field(..., description="Number of messages saved")
    saved_to_database: bool = Field(..., description="Whether saved to database")
    message: str = Field(..., description="Status message")
    closed_at: datetime = Field(default_factory=datetime.utcnow)

class ChatHistoryItem(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    first_message: str = Field(..., description="Preview of first message")
    message_count: int = Field(..., description="Total messages in session")
    created_at: datetime = Field(..., description="Session created time")
    updated_at: datetime = Field(..., description="Last updated time")
    status: SessionStatus = Field(..., description="Current session status")

class ChatHistoryResponse(BaseModel):
    user_id: str = Field(..., description="User identifier")
    sessions: List[ChatHistoryItem] = Field(..., description="List of chat sessions")
    total_sessions: int = Field(..., description="Total number of sessions")
    page_info: Dict[str, int] = Field(..., description="Pagination info")

# class CodeCompletionResponse(BaseModel):
#     completion: str = Field(..., description="Generated code completion")
#     confidence: float = Field(..., ge=0.0, le=1.0, description="Completion confidence score")
#     language: SupportedLanguage
#     suggestions_count: int = Field(default=1, description="Number of suggestions provided")
#     processing_time_ms: Optional[int] = Field(None, description="Processing time in milliseconds")
#     alternative_completions: Optional[List[str]] = Field(None, description="Alternative completions")
#     user_id: str = Field(..., description="User identifier")

class CodeCompletionResponse(BaseModel):
    completion: str
    confidence: float
    language: SupportedLanguage
    suggestions_count: int = 1
    processing_time_ms: Optional[int] = None
    alternative_completions: Optional[List[str]] = None
    user_id: str


# Database models (Postgres)
class ChatSession(TimestampedModel):
    """
    Persist entire conversation in metadata (e.g., {'messages': [...]}).
    """
    id: Optional[int] = None
    session_id: str = Field(..., max_length=255)
    user_id: str = Field(..., max_length=50, description="User identifier")
    metadata: Optional[Dict[str, Any]] = None


# Session info & bulk ops
class SessionInfo(BaseModel):
    session_id: str = Field(..., description="Session identifier")
    user_id: str = Field(..., description="User identifier")
    status: SessionStatus = Field(..., description="Current session status")
    message_count: int = Field(..., description="Number of messages")
    in_cache: bool = Field(..., description="Whether in Redis cache")
    created_at: datetime = Field(..., description="Creation time")
    last_activity: Optional[datetime] = Field(None, description="Last activity time")

class BulkSessionOperation(BaseModel):
    user_id: str = Field(..., description="User identifier")
    session_ids: List[str] = Field(..., description="List of session IDs")
    operation: str = Field(..., description="Operation to perform")  # close, delete, load

# Error / Health / App config
class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    features: List[str] = Field(..., description="Available features")
    model: str = Field(..., description="AI model in use")
    database_connected: bool = Field(..., description="Database connection status")
    redis_connected: bool = Field(..., description="Redis connection status")
    uptime_seconds: Optional[float] = Field(None, description="Service uptime in seconds")
    active_sessions_count: Optional[int] = Field(None, description="Number of active sessions in cache")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ModelConfig(BaseModel):
    name: str = Field(..., description="Model name")
    base_url: str = Field(..., description="API base URL")
    api_key: str = Field(..., description="API key")
    default_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    default_top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    default_max_tokens: int = Field(default=1024, ge=1, le=4096)
    timeout_seconds: int = Field(default=15, ge=1, le=60)

class AppConfig(BaseModel):
    app_name: str = Field(default="RaaS Chat API")
    version: str = Field(default="2.3.0")
    debug: bool = Field(default=False)
    # kept generic cache knobs (no file-upload knobs since feature is removed)
    cache_ttl_seconds: int = Field(default=86400, ge=3600, le=604800)
    max_sessions_per_user: int = Field(default=100, ge=1, le=1000, description="Max sessions per user")
    auto_cleanup_hours: int = Field(default=24, ge=1, le=168, description="Auto cleanup old cache")
