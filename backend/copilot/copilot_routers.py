# from fastapi import APIRouter, HTTPException, UploadFile, File, Form,Body,Query
# from database.schema import (
#     ChatRequest, ChatResponse,
#     CodeCompletionRequest, CodeCompletionResponse,
#     ChatHistoryResponse,LoadChatResponse,CloseChatResponse,StartChatResponse,
#    StartChatRequest,LoadChatRequest,CloseChatRequest,ChatHistoryItem,ChatSession,
#    BulkSessionOperation,SessionStatus,SessionInfo,
#     HealthCheckResponse, AppConfig,
# )
# from .copilot_service import ChatService, code_completion_service, FileService
# from model import ai_model
# from redis_client import redis_client
# from database.connection import db_client
# import logging
# import datetime
# from typing import List, Optional
# import uuid
# import json
# from typing import Any, Dict
# logger = logging.getLogger(__name__)

# # Routers
# chat_router = APIRouter(prefix="/api/v1", tags=["Chat"])
# code_router = APIRouter(prefix="/api/v1", tags=["Code Completion"])
# health_router = APIRouter(prefix="/api/v1", tags=["Health"])


# # App configuration
# app_config = AppConfig()


# # Chat endpoints


# def generate_session_id():
#     timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
#     unique_id = str(uuid.uuid4())
#     return f"{timestamp}-{unique_id}"

# # A) JSON route (no files) — Content-Type: application/json
# @chat_router.post("/chat", response_model=ChatResponse)
# async def chat_json(request: ChatRequest):
#     """Pure JSON chat: send ChatRequest body without files."""
    
#     try:
#         if not request.text.strip():
#             raise HTTPException(status_code=400, detail="Message text cannot be empty.")
#         if len(request.text) > 50_000:
#             raise HTTPException(status_code=400, detail="Message too long (max 50k characters)." )

#         return await ChatService.process_chat_request(request)

#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"/chat (json) error: {e}")
#         raise HTTPException(status_code=500, detail="Internal server error")

# @chat_router.post("/chat/form", response_model=ChatResponse)
# async def chat_form(
#     text: str = Form(...),
#     user_id: str = Form(...),
#     files: List[UploadFile] = File(None),
#     session_id = generate_session_id(),
#     inline_files: Optional[str] = Form(None),  # <-- add this
# ):
    
#     # if not session_id:
#     #     session_id = session_id() or generate_session_id()

#     if not text.strip():
#         raise HTTPException(status_code=400, detail="Message text cannot be empty.")
#     if len(text) > 50_000:
#         raise HTTPException(status_code=400, detail="Message too long (max 50k characters).")

#     # 1) Handle uploaded files
#     had_extracted = False
#     if files:
#         for f in files:
#             if not f or not getattr(f, "filename", None):
#                 continue
#             raw = await f.read()
#             if not raw:
#                 continue
#             extracted = await FileService.extract_text_from_bytes(
#                 raw, f.content_type or "application/octet-stream", f.filename
#             )
#             if extracted:
#                 had_extracted = True
#                 excerpt = extracted[:50_000]
#                 await ChatService.store_message(
#                     session_id=session_id,
#                     user_id=user_id,
#                     role="system",
#                     content=f"[Attachment: {f.filename}]\n{excerpt}",
#                 )

#     # 1b) Fallback: inline files text (if extractor couldn’t read uploaded parts)
#     if not had_extracted and inline_files:
#         try:
#             items: list[dict[str, Any]] = json.loads(inline_files)
#             for item in items:
#                 name = item.get("name") or "attachment"
#                 text_body = (item.get("text") or "")[:50_000]
#                 if text_body:
#                     await ChatService.store_message(
#                         session_id=session_id,
#                         user_id=user_id,
#                         role="system",
#                         content=f"[Attachment: {name}]\n{text_body}",
#                     )
#         except Exception:
#             pass

#     # 2) Process chat
#     request = ChatRequest(text=text.strip(), session_id=session_id, user_id=user_id)
#     return await ChatService.process_chat_request(request)


# # @chat_router.post("/chat/flush")
# # async def flush_session(
# #     session_id: str = Form(...),
# #     user_id: str = Form(...),
# #     clear_cache: bool = Form(True),
# # ):
# #     """Persist the entire session from Redis to Postgres; optionally clear the cache."""
# #     try:
# #         stored = await ChatService.flush_session_to_db(
# #             session_id=session_id,
# #             user_id=user_id,
# #             clear_cache=clear_cache,
# #             reason="close_chat",
# #         )
# #         return {
# #             "success": True,
# #             "session_id": session_id,
# #             "stored_count": stored,
# #             "cleared": bool(clear_cache),
# #         }
# #     except Exception as e:
# #         logger.error(f"Flush error: {e}")
# #         raise HTTPException(status_code=500, detail="Failed to flush session")



# # Code completion

# @code_router.post("/code-completion", response_model=CodeCompletionResponse)
# async def code_completion(request: CodeCompletionRequest):
#     """Handle code completion requests."""
#     try:
#         logger.info(f"Code completion request - Language: {request.language}")

#         if not request.text.strip():
#             raise HTTPException(status_code=400, detail="Code text cannot be empty")
#         if len(request.text) > 2000:
#             raise HTTPException(status_code=400, detail="Code context too long (max 2000 characters)")

#         completion, processing_time, confidence = await code_completion_service.get_completion(request)

#         return CodeCompletionResponse(
#             completion=completion,
#             confidence=confidence,
#             language=(request.language.value if request.language else "python"),
#             suggestions_count=1 if completion else 0,
#             processing_time_ms=processing_time,
#             user_id=request.user_id,
#         )
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Code completion error: {e}")
#         raise HTTPException(status_code=500, detail="Internal server error")


# @chat_router.get("/chat/sessions", response_model=ChatHistoryResponse)
# async def list_sessions(user_id: str, limit: int = 30, offset: int = 0):
#     try:
#         rows = await ChatService.list_user_sessions(user_id, limit, offset)
#         items = [
#             ChatHistoryItem(
#                 session_id=r["session_id"],
#                 first_message=r["first_message"],
#                 message_count=r["message_count"],
#                 created_at=r["created_at"],
#                 updated_at=r["updated_at"],
#                 status=SessionStatus.ARCHIVED,
#             )
#             for r in rows
#         ]
#         # optional total; if you don’t have a helper use len(items)
#         total = len(items)
#         return ChatHistoryResponse(
#             user_id=user_id,
#             sessions=items,
#             total_sessions=total,
#             page_info={"limit": limit, "offset": offset},
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"List sessions failed: {e}")

# @chat_router.post("/chat/session/load", response_model=LoadChatResponse)
# async def load_session(payload: LoadChatRequest = Body(...)):
#     try:
#         resp = await ChatService.load_session_to_cache(
#             session_id=payload.session_id,
#             user_id=payload.user_id,
#         )
#         return resp
#     except Exception as e:
#         logger.error(f"/chat/session/load error: {e}")
#         raise HTTPException(status_code=500, detail=f"Load session failed: {e}")


# @chat_router.post("/chat/session/close", response_model=CloseChatResponse)
# async def close_session(payload: CloseChatRequest = Body(...)):
#     try:
#         saved = await ChatService.flush_session_to_db(
#             session_id=payload.session_id,
#             user_id=payload.user_id,
#             clear_cache=True,
#             reason="user_close"
#         )
#         return CloseChatResponse(
#             session_id=payload.session_id,
#             user_id=payload.user_id,
#             message_count=saved,
#             saved_to_database=bool(saved),
#             message="Session closed and persisted" if saved else "No messages to persist",
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Close session failed: {e}")

# # Optional: start a new session and (optionally) flush the previous one first.
# @chat_router.post("/chat/session/new", response_model=StartChatResponse)
# async def start_session(payload: StartChatRequest = Body(...), prev_session_id: Optional[str] = Query(None)):
#     import time
#     try:
#         if prev_session_id:
#             try:
#                 await ChatService.flush_session_to_db(prev_session_id, payload.user_id, clear_cache=True, reason="switch_to_new")
#             except Exception as fe:
#                 logging.warning(f"Failed to flush previous session {prev_session_id}: {fe}")

#         session_id = payload.session_id or f"{payload.user_id}_{int(time.time())}"
#         if payload.initial_message:
#             await ChatService.store_message(session_id, payload.user_id, "user", payload.initial_message.strip())

#         return StartChatResponse(
#             session_id=session_id,
#             user_id=payload.user_id,
#             status=SessionStatus.ACTIVE,
#             message="New session started",
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Start session failed: {e}")


# # Health / info

# @health_router.get("/model-info")
# async def get_model_info():
#     """Get AI model information."""
#     try:
#         return ai_model.get_model_info()
#     except Exception as e:
#         logger.error(f"Error getting model info: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @health_router.get("/stats")
# async def get_system_stats():
#     """Basic service stats."""
#     try:
#         stats = {
#             "ai_model_initialized": ai_model.is_initialized,
#             "redis_connected": redis_client.is_connected,
#             "database_connected": db_client.is_connected,
#         }

#         if db_client.is_connected:
#             try:
#                 chat_sessions = await db_client.fetch_one("SELECT COUNT(*) AS count FROM chat_sessions")
#                 code_completions = await db_client.fetch_one("SELECT COUNT(*) AS count FROM code_completions")
#                 stats.update({
#                     "total_chat_sessions": (chat_sessions or {}).get("count", 0),
#                     "total_code_completions": (code_completions or {}).get("count", 0),
#                 })
#             except Exception as e:
#                 logger.warning(f"Error getting database stats: {e}")

#         return stats

#     except Exception as e:
#         logger.error(f"Error getting system stats: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @health_router.get("/health", response_model=HealthCheckResponse)
# async def health_check():
#     """Health check endpoint."""
#     try:
#         model_info = ai_model.get_model_info()
#         return HealthCheckResponse(
#             status="healthy" if ai_model.is_initialized else "degraded",
#             version=app_config.version,
#             features=["chat", "code_completion", "session_lifecycle"],
#             model=model_info.get("model_name", "unknown"),
#             database_connected=db_client.is_connected,
#             redis_connected=redis_client.is_connected,
#             uptime_seconds=None,
#             timestamp=datetime.utcnow(),
#         )
#     except Exception as e:
#         logger.error(f"Health check error: {e}")
#         return HealthCheckResponse(
#             status="unhealthy",
#             version=app_config.version,
#             features=[],
#             model="unknown",
#             database_connected=False,
#             redis_connected=False,
#             timestamp=datetime.utcnow(),
#         )


# def get_routers() -> List[APIRouter]:
#     """Get all API routers."""
#     return [chat_router, code_router, health_router]

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body, Query
from database.schema import (
    ChatRequest, ChatResponse,
    CodeCompletionRequest, CodeCompletionResponse,
    ChatHistoryResponse, LoadChatResponse, CloseChatResponse, StartChatResponse,
    StartChatRequest, LoadChatRequest, CloseChatRequest, ChatHistoryItem, ChatSession,
    BulkSessionOperation, SessionStatus, SessionInfo,
    HealthCheckResponse, AppConfig,
)
from .copilot_service import ChatService, code_completion_service, FileService
from model import ai_model
from redis_client import redis_client
from database.connection import db_client
import logging
import datetime
from typing import List, Optional
import uuid
import json
from typing import Any, Dict

logger = logging.getLogger(__name__)

# Routers
chat_router = APIRouter(prefix="/api/v1", tags=["Chat"])
code_router = APIRouter(prefix="/api/v1", tags=["Code Completion"])
health_router = APIRouter(prefix="/api/v1", tags=["Health"])

# App configuration
app_config = AppConfig()

def generate_session_id():
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())
    return f"{timestamp}-{unique_id}"

# A) JSON route (no files) — Content-Type: application/json
@chat_router.post("/chat", response_model=ChatResponse)
async def chat_json(request: ChatRequest):
    """Pure JSON chat: send ChatRequest body without files."""
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Message text cannot be empty.")
        if len(request.text) > 50_000:
            raise HTTPException(status_code=400, detail="Message too long (max 50k characters).")

        return await ChatService.process_chat_request(request)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/chat (json) error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@chat_router.post("/chat/form", response_model=ChatResponse)
async def chat_form(
    text: str = Form(...),
    user_id: str = Form(...),
    files: List[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),  # Changed: make it optional and from Form
    inline_files: Optional[str] = Form(None),
):
    """
    Fixed version: Don't generate new session_id each time.
    Use the session_id from frontend, or generate only if truly missing.
    """
    
    # Only generate if not provided
    if not session_id:
        session_id = generate_session_id()
        logger.info(f"Generated new session_id: {session_id}")
    else:
        logger.info(f"Using existing session_id: {session_id}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Message text cannot be empty.")
    if len(text) > 50_000:
        raise HTTPException(status_code=400, detail="Message too long (max 50k characters).")

    # 1) Handle uploaded files - store as system messages
    had_extracted = False
    if files:
        for f in files:
            if not f or not getattr(f, "filename", None):
                continue
            raw = await f.read()
            if not raw:
                continue
            extracted = await FileService.extract_text_from_bytes(
                raw, f.content_type or "application/octet-stream", f.filename
            )
            if extracted:
                had_extracted = True
                excerpt = extracted[:50_000]
                # Store file content as system message
                await ChatService.store_message(
                    session_id=session_id,
                    user_id=user_id,
                    role="system",
                    content=f"[Attachment: {f.filename}]\n{excerpt}",
                )
                logger.info(f"Stored file {f.filename} as system message in session {session_id}")

    # 1b) Fallback: inline files text (if extractor couldn't read uploaded parts)
    if not had_extracted and inline_files:
        try:
            items: list[dict[str, Any]] = json.loads(inline_files)
            for item in items:
                name = item.get("name") or "attachment"
                text_body = (item.get("text") or "")[:50_000]
                if text_body:
                    await ChatService.store_message(
                        session_id=session_id,
                        user_id=user_id,
                        role="system",
                        content=f"[Attachment: {name}]\n{text_body}",
                    )
                    logger.info(f"Stored inline file {name} as system message in session {session_id}")
        except Exception as e:
            logger.error(f"Error processing inline files: {e}")

    # 2) Process chat with the existing session_id
    request = ChatRequest(text=text.strip(), session_id=session_id, user_id=user_id)
    response = await ChatService.process_chat_request(request)
    
    # Ensure session_id is returned so frontend can track it
    response.session_id = session_id
    return response

# Code completion
# @code_router.post("/code-completion", response_model=CodeCompletionResponse)
# async def code_completion(request: CodeCompletionRequest):
#     """Handle code completion requests."""
#     try:
#         logger.info(f"Code completion request - Language: {request.language}")

#         if not request.text.strip():
#             raise HTTPException(status_code=400, detail="Code text cannot be empty")
#         if len(request.text) > 2000:
#             raise HTTPException(status_code=400, detail="Code context too long (max 2000 characters)")

#         completion, processing_time, confidence = await code_completion_service.get_completion(request)

#         return CodeCompletionResponse(
#             completion=completion,
#             confidence=confidence,
#             language=(request.language.value if request.language else "python"),
#             suggestions_count=1 if completion else 0,
#             processing_time_ms=processing_time,
#             user_id=request.user_id,
#         )
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Code completion error: {e}")
#         raise HTTPException(status_code=500, detail="Internal server error")


@code_router.post("/code-completion", response_model=CodeCompletionResponse)
async def code_completion(request: CodeCompletionRequest):
    """Handle code completion requests."""
    try:
        logger.info(f"Code completion request - Language: {request.language}, Text length: {len(request.text)}")
        logger.debug(f"Code completion context: {request.context}")

        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Code text cannot be empty")
        if len(request.text) > 10000:  # Increased limit for code completion
            raise HTTPException(status_code=400, detail="Code context too long (max 10k characters)")

        completion, processing_time, confidence = await code_completion_service.get_completion(request)

        logger.info(f"Completion generated - Length: {len(completion)}, Confidence: {confidence}")

        return CodeCompletionResponse(
            completion=completion,
            confidence=confidence,
            language=(request.language.value if request.language else "python"),
            suggestions_count=1 if completion else 0,
            processing_time_ms=processing_time,
            user_id=request.user_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Code completion error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Code completion failed: {str(e)}")
    
@code_router.get("/code-completion/test")
async def test_completion():
    """Test endpoint to verify completion service is working."""
    try:
        return {
            "status": "ok",
            "service_initialized": True,
            "model_available": ai_model.is_initialized,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Test completion error: {e}")
        return {
            "status": "error", 
            "error": str(e),
            "timestamp": datetime.datetime.utcnow().isoformat()
        }


@chat_router.get("/chat/sessions", response_model=ChatHistoryResponse)
async def list_sessions(user_id: str, limit: int = 30, offset: int = 0):
    try:
        rows = await ChatService.list_user_sessions(user_id, limit, offset)
        items = [
            ChatHistoryItem(
                session_id=r["session_id"],
                first_message=r["first_message"],
                message_count=r["message_count"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                status=SessionStatus.ARCHIVED,
            )
            for r in rows
        ]
        total = len(items)
        return ChatHistoryResponse(
            user_id=user_id,
            sessions=items,
            total_sessions=total,
            page_info={"limit": limit, "offset": offset},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"List sessions failed: {e}")

@chat_router.post("/chat/session/load", response_model=LoadChatResponse)
async def load_session(payload: LoadChatRequest = Body(...)):
    try:
        resp = await ChatService.load_session_to_cache(
            session_id=payload.session_id,
            user_id=payload.user_id,
        )
        return resp
    except Exception as e:
        logger.error(f"/chat/session/load error: {e}")
        raise HTTPException(status_code=500, detail=f"Load session failed: {e}")

@chat_router.post("/chat/session/close", response_model=CloseChatResponse)
async def close_session(payload: CloseChatRequest = Body(...)):
    try:
        saved = await ChatService.flush_session_to_db(
            session_id=payload.session_id,
            user_id=payload.user_id,
            clear_cache=True,
            reason="user_close"
        )
        return CloseChatResponse(
            session_id=payload.session_id,
            user_id=payload.user_id,
            message_count=saved,
            saved_to_database=bool(saved),
            message="Session closed and persisted" if saved else "No messages to persist",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Close session failed: {e}")

@chat_router.post("/chat/session/new", response_model=StartChatResponse)
async def start_session(payload: StartChatRequest = Body(...), prev_session_id: Optional[str] = Query(None)):
    import time
    try:
        if prev_session_id:
            try:
                await ChatService.flush_session_to_db(prev_session_id, payload.user_id, clear_cache=True, reason="switch_to_new")
            except Exception as fe:
                logging.warning(f"Failed to flush previous session {prev_session_id}: {fe}")

        session_id = payload.session_id or f"{payload.user_id}_{int(time.time())}"
        if payload.initial_message:
            await ChatService.store_message(session_id, payload.user_id, "user", payload.initial_message.strip())

        return StartChatResponse(
            session_id=session_id,
            user_id=payload.user_id,
            status=SessionStatus.ACTIVE,
            message="New session started",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Start session failed: {e}")

# Health / info
@health_router.get("/model-info")
async def get_model_info():
    """Get AI model information."""
    try:
        return ai_model.get_model_info()
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@health_router.get("/stats")
async def get_system_stats():
    """Basic service stats."""
    try:
        stats = {
            "ai_model_initialized": ai_model.is_initialized,
            "redis_connected": redis_client.is_connected,
            "database_connected": db_client.is_connected,
        }

        if db_client.is_connected:
            try:
                chat_sessions = await db_client.fetch_one("SELECT COUNT(*) AS count FROM chat_sessions")
                code_completions = await db_client.fetch_one("SELECT COUNT(*) AS count FROM code_completions")
                stats.update({
                    "total_chat_sessions": (chat_sessions or {}).get("count", 0),
                    "total_code_completions": (code_completions or {}).get("count", 0),
                })
            except Exception as e:
                logger.warning(f"Error getting database stats: {e}")

        return stats

    except Exception as e:
        logger.error(f"Error getting system stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@health_router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint."""
    try:
        model_info = ai_model.get_model_info()
        return HealthCheckResponse(
            status="healthy" if ai_model.is_initialized else "degraded",
            version=app_config.version,
            features=["chat", "code_completion", "session_lifecycle"],
            model=model_info.get("model_name", "unknown"),
            database_connected=db_client.is_connected,
            redis_connected=redis_client.is_connected,
            uptime_seconds=None,
            timestamp=datetime.utcnow(),
        )
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return HealthCheckResponse(
            status="unhealthy",
            version=app_config.version,
            features=[],
            model="unknown",
            database_connected=False,
            redis_connected=False,
            timestamp=datetime.utcnow(),
        )

def get_routers() -> List[APIRouter]:
    """Get all API routers."""
    return [chat_router, code_router, health_router]