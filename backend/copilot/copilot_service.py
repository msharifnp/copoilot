import os, json, re, glob, asyncio, logging, tempfile,csv,io
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import fnmatch
import magic

from language_contexts import get_language_contexts
from model import ai_model
from redis_client import redis_client
from database.connection import db_client
from database.schema import (
    ChatRequest, ChatResponse,
    CodeCompletionRequest, CodeCompletionResponse,
    SupportedLanguage, SessionStatus,LoadChatRequest,
    LoadChatResponse,SessionInfo
    
)
from docx import Document
from openpyxl import load_workbook
import xlrd
from PyPDF2 import PdfReader
from PIL import Image
import pytesseract
from dotenv import load_dotenv


load_dotenv()
MAX_BEFORE = int(os.getenv("CODE_COMPLETION_MAX_BEFORE"))
MAX_AFTER = int(os.getenv("CODE_COMPLETION_MAX_AFTER"))
temperature = float(os.getenv("CODE_COMPLETION_TEMPERATURE"))
top_p = float(os.getenv("TOP_P"))
max_tokens = int(os.getenv("CODE_COMPLETION_MAX_TOKENS"))

logger = logging.getLogger(__name__)




class ProjectContextService:
    """Service for managing project context and file analysis"""

    @staticmethod
    def get_project_context(
        root_dir: str,
        exclude_patterns: Optional[List[str]] = None,
        # max_chars: int = 3000,
        # cache_ttl: int = 300
        max_chars=int(os.getenv("PROJECT_MAX_CHARS")),
        cache_ttl=int(os.getenv("PROJECT_TTL_SEC"))
    ) -> str:
        """
        Read code files under root_dir into a single string for context,
        cache in Redis, and respect max_chars.
        """
        cache_key = f"project_context:{os.path.abspath(root_dir)}"

        # 1) Try Redis cache
        if redis_client.is_connected:
            try:
                cached = redis_client.get(cache_key)
            except AttributeError:
                cached = None
            if cached:
                logger.info(f"Using cached project context for {root_dir}")
                return cached

        # 2) Build fresh context
        if exclude_patterns is None:
            exclude_patterns = [
                "*.pyc", "__pycache__/*", "*.log", "*.tmp",
                "node_modules/*", ".git/*"
            ]

        files = glob.glob(os.path.join(root_dir, "**", "*.*"), recursive=True)
        context_parts: List[str] = []
        total_len = 0

        for file_path in files:
            if any(fnmatch.fnmatch(file_path, pat) for pat in exclude_patterns):
                continue
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                part = f"\n# FILE: {os.path.relpath(file_path, root_dir)}\n{content}"
                context_parts.append(part)
                total_len += len(part)
                if total_len > max_chars:
                    break
            except Exception:
                continue

        project_context = "".join(context_parts)[:max_chars]

        # 3) Cache to Redis (best-effort)
        if redis_client.is_connected:
            try:
                redis_client.set_with_expiry(cache_key, project_context, cache_ttl)
                logger.info(f"Cached project context for {root_dir} in Redis")
            except AttributeError:
                pass

        return project_context


class CodeCompletionService:
    """Service for handling code completion logic"""

    def __init__(self):
        self.completion_cache: Dict[str, str] = {}
        self.language_contexts = get_language_contexts()
        self._last_before_text = ""

    def create_completion_prompt(self, request: CodeCompletionRequest) -> Tuple[str, Dict[str, Any]]:
        language = request.language or SupportedLanguage.PYTHON
        context = request.context or {}

        lang_context = self.language_contexts.get(language, self.language_contexts[SupportedLanguage.PYTHON])
        config = lang_context["config"]

        before_text = context.get("before", "")
        after_text  = context.get("after", "")

        self._last_before_text = before_text

        # Bound context
        max_before, max_after = MAX_BEFORE, MAX_AFTER
        if len(before_text) > max_before:
            before_text = "..." + before_text[-max_before:]
        if len(after_text) > max_after:
            after_text = after_text[:max_after] + "..."

        # Optional project context (best-effort)
        project_context = ""
        if request.file_path:
            project_root = os.path.dirname(request.file_path)
            project_context = ProjectContextService.get_project_context(project_root)

        prompt = f"""You are a {language.value} coding assistant.

PROJECT CONTEXT:
{project_context}

CODE TO COMPLETE:
```{language.value}
{before_text}[CURSOR_HERE]{after_text}
```

INSTRUCTIONS:
- Replace [CURSOR_HERE] with appropriate {language.value} code
- Follow {language.value} best practices and syntax
- Provide only the code that should replace [CURSOR_HERE]
- Keep the completion concise and relevant
- Do not include explanations or comments

COMPLETION:"""
        return prompt, config

    def post_process_completion(self, completion: str, language: SupportedLanguage) -> str:
        if not completion:
            return ""

        completion = completion.strip()
        completion = re.sub(r"```[\w]*\n?", "", completion)
        completion = re.sub(r"```", "", completion)

        for prefix in [
            "Here's", "The completion", "Complete", "COMPLETION:",
            f"{language.value}:", "Code:", "Answer:", "Result:", "Output:"
        ]:
            if completion.lower().startswith(prefix.lower()):
                completion = completion[len(prefix):].strip()
                break

        # Stop at explanatory text
        lines = completion.split("\n")
        code_lines: List[str] = []
        for line in lines:
            if any(word in line.lower() for word in [
                "this code", "explanation", "note:", "this will", "this is",
                "the above", "this function", "this creates", "this defines"
            ]):
                break
            code_lines.append(line)
        completion = "\n".join(code_lines).strip()

        # Indentation fix
        if getattr(self, "_last_before_text", ""):
            last_line = self._last_before_text.split("\n")[-1]
            m = re.match(r"^(\s+)", last_line)
            base_indent = m.group(1) if m else ""
            fixed = []
            for i, line in enumerate(completion.split("\n")):
                fixed.append(line if i == 0 else base_indent + line)
            completion = "\n".join(fixed)
            before_last_line = last_line.strip()
            if completion.lower().startswith(before_last_line.lower()):
                completion = completion[len(before_last_line):].lstrip()

        # Balance brackets/quotes
        bracket_pairs = {"(": ")", "[": "]", "{": "}"}
        quote_pairs   = {'"': '"', "'": "'"}
        for open_b, close_b in bracket_pairs.items():
            if completion.count(open_b) > completion.count(close_b):
                completion += close_b * (completion.count(open_b) - completion.count(close_b))
        for q in quote_pairs:
            if completion.count(q) % 2 != 0:
                completion += q

        return completion[:150]

    async def get_completion(self, request: CodeCompletionRequest) -> Tuple[str, int, float]:
        start = asyncio.get_event_loop().time()
        try:
            cache_key = f"{request.language}:{hash(str(request.context))}"
            if cache_key in self.completion_cache:
                processing_time = int((asyncio.get_event_loop().time() - start) * 1000)
                cached = self.completion_cache[cache_key]
                return cached, processing_time, 0.9

            prompt, config = self.create_completion_prompt(request)
            logger.info(f"Generating completion for {request.language}")

            completion_text, success = await ai_model.generate_code_completion(
                prompt=prompt,
                language=request.language.value if request.language else "python",
                temperature=config["temperature"],
                max_tokens=config["max_tokens"],
                timeout=10
            )
            if not success or not completion_text:
                return "", int((asyncio.get_event_loop().time() - start) * 1000), 0.0

            completion = self.post_process_completion(completion_text, request.language or SupportedLanguage.PYTHON)

            confidence = 0.8 if completion and len(completion.strip()) > 5 else 0.0
            if completion and len(completion) > 20:
                confidence = min(0.95, confidence + 0.1)

            if completion and len(completion.strip()) > 2:
                if len(self.completion_cache) > 50:
                    oldest_key = next(iter(self.completion_cache))
                    del self.completion_cache[oldest_key]
                self.completion_cache[cache_key] = completion

            processing_time = int((asyncio.get_event_loop().time() - start) * 1000)
            return completion, processing_time, confidence

        except Exception as e:
            logger.error(f"Code completion error: {e}")
            processing_time = int((asyncio.get_event_loop().time() - start) * 1000)
            return "", processing_time, 0.0

class ChatService:
    """Service for handling chat functionality"""

    # ---------- Write to cache during live chat ----------

    @staticmethod
    async def store_message(session_id: str, user_id: str, role: str, content: str) -> bool:
        """
        Store message in Redis ONLY during live conversation.
        Postgres persistence happens on explicit flush/close.
        """
        try:
            if not redis_client.is_connected:
                return False
            ok = redis_client.add_chat_message(
                session_id=session_id, role=role, content=content, user_id=user_id
            )
            return bool(ok)
        except Exception as e:
            logger.error(f"Error storing message: {e}")
            return False

    @staticmethod
    async def get_chat_history(session_id: str, user_id: str) -> List[Dict[str, Any]]:
        try:
            if redis_client.is_connected:
                msgs = redis_client.get_chat_messages(session_id, user_id=user_id) or []
                return msgs
        except Exception as e:
            logger.warning(f"Redis get_chat_messages failed: {e}")

        # ✅ DB fallback MUST pass user_id
        try:
            if db_client.is_connected:
                sess = await db_client.get_chat_session(session_id, user_id)
                if sess and isinstance(sess.get("messages"), list):
                    return sess["messages"]
        except Exception as e:
            logger.warning(f"DB fallback for history failed: {e}")

        return []


    # ---------- Persist cache -> DB on close/new ----------

    @staticmethod
    async def flush_session_to_db(
        session_id: str,
        user_id: str,
        clear_cache: bool = True,
        reason: str = "close_chat",
    ) -> int:
        """
        Pull all messages from Redis and persist the entire session as one row in chat_sessions.metadata.
        """
        try:
            messages: List[Dict[str, Any]] = []
            if redis_client.is_connected:
                messages = redis_client.get_chat_messages(session_id, user_id=user_id) or []

            if not messages:
                return 0

            if db_client.is_connected:
                ok = await db_client.save_chat_session(
                    session_id=session_id,
                    messages=messages,
                    user_id=user_id,
                )
                if not ok:
                    return 0

            if clear_cache and redis_client.is_connected:
                try:
                    redis_client.clear_chat_cache(session_id, user_id=user_id)
                except TypeError:
                    # if old signature
                    redis_client.clear_chat_cache(session_id)

            return len(messages)
        except Exception as e:
            logger.error(f"flush_session_to_db error: {e}")
            return 0

    @staticmethod
    async def get_message_count(session_id: str, user_id: str) -> int:
        """Get total message count for session (cache-first)."""
        try:
            if redis_client.is_connected:
                if hasattr(redis_client, "get_session_message_count"):
                    n = redis_client.get_session_message_count(session_id, user_id=user_id)
                    if n is not None:
                        return int(n)
                msgs = redis_client.get_chat_messages(session_id, user_id=user_id) or []
                return len(msgs)
            return 0
        except Exception as e:
            logger.error(f"Error getting message count: {e}")
            return 0

    @staticmethod
    async def process_chat_request(request: ChatRequest) -> ChatResponse:
        start = asyncio.get_event_loop().time()
        session_id, user_id = request.session_id, request.user_id

        # Fetch history from Redis (already chronological oldest -> newest in your client)
        history = await ChatService.get_chat_history(session_id, user_id)

        # Number of user+assistant "pairs" and most-recent system messages  to keep
        pairs_to_keep = int(os.getenv("CHAT_CONTEXT_PAIRS"))
        system_to_keep = int(os.getenv("CHAT_SYSTEM_CONTEXT"))
        

        # Split by role
        system_msgs = [m for m in history if (m.get("role") == "system" and m.get("content"))]
        dialog_msgs = [m for m in history if (m.get("role") in ("user", "assistant") and m.get("content"))]

        # Keep only last N pairs (N*2 messages) of dialog
        keep_dialog = dialog_msgs[-(pairs_to_keep * 2):] if pairs_to_keep > 0 else []

        # Keep only the most recent system messages (if any)
        keep_system = system_msgs[-system_to_keep:] if system_to_keep > 0 else []

        # Build model messages (system first, then dialog), then add the current user message
        model_msgs = []
        model_msgs.extend({"role": m["role"], "content": m["content"]} for m in keep_system)
        model_msgs.extend({"role": m["role"], "content": m["content"]} for m in keep_dialog)
        model_msgs.append({"role": "user", "content": request.text})

        # Call model
        ai_text = await ai_model.generate_chat_response(model_msgs)

        # Cache user + assistant messages back to Redis
        await ChatService.store_message(session_id, user_id, "user", request.text)
        await ChatService.store_message(session_id, user_id, "assistant", ai_text)

        # Respond
        count = await ChatService.get_message_count(session_id, user_id)
        ms = int((asyncio.get_event_loop().time() - start) * 1000)

        return ChatResponse(
            response=ai_text,
            message_count=count,
            session_id=session_id,
            user_id=user_id,
            session_status=SessionStatus.ACTIVE,
            in_cache=True,
            model_used="gemini-1.5-pro",
            processing_time_ms=ms
        )
       
    @staticmethod
    async def load_session_to_cache(session_id: str, user_id: str, ttl: Optional[int] = None) -> LoadChatResponse:
        try:
            sess = await db_client.get_chat_session(session_id, user_id)
            if not sess:
                return LoadChatResponse(
                    session_id=session_id,
                    user_id=user_id,
                    message_count=0,
                    status=SessionStatus.LOADED,
                    message="No session found",
                    last_updated=None,
                )

            # --- normalize the shape defensively ---
            if isinstance(sess, str):
                # Some older/other codepath returned raw JSON
                try:
                    sess = json.loads(sess)
                except Exception:
                    raise TypeError("DB returned a string; expected an object. Check save_chat_session json.dumps and jsonb column.")

            messages = None
            if isinstance(sess, dict):
                # prefer already-extracted messages
                messages = sess.get("messages")
                if not isinstance(messages, list):
                    # fallback: look under metadata.messages
                    md = sess.get("metadata") if isinstance(sess.get("metadata"), dict) else {}
                    messages = md.get("messages") if isinstance(md.get("messages"), list) else []

            if messages is None:
                messages = []

            # hydrate Redis
            redis_client.load_chat_to_cache(session_id, messages, user_id=user_id, ttl=ttl)

            return LoadChatResponse(
                session_id=session_id,
                user_id=user_id,
                message_count=len(messages),
                status=SessionStatus.LOADED,
                message="Session loaded to cache",
                last_updated=sess.get("updated_at") if isinstance(sess, dict) else None,
            )
        except Exception as e:
            logger.error(f"load_session_to_cache error: {e}")
            raise
        
    @staticmethod
    async def list_user_sessions(user_id: str, limit: int = 30, offset: int = 0) -> List[Dict[str, Any]]:
        """
        List saved sessions from Postgres for history/sidebar (archived list).
        """
        rows = []
        try:
            if hasattr(db_client, "fetch_all"):
                rows = await db_client.fetch_all(
                    "SELECT session_id, user_id, metadata, created_at, updated_at "
                    "FROM chat_sessions WHERE user_id = $1 "
                    "ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
                    user_id, limit, offset
                )
            elif hasattr(db_client, "list_chat_sessions"):
                rows = await db_client.list_chat_sessions(user_id, limit, offset)
        except Exception as e:
            logger.error(f"list_user_sessions DB error: {e}")
            return []

        items: List[Dict[str, Any]] = []
        for r in rows or []:
            meta = r.get("metadata") or {}
            msgs = meta.get("messages") if isinstance(meta, dict) else []
            msgs = msgs if isinstance(msgs, list) else []
            first = ""
            if msgs:
                c = (msgs[0].get("content") or "")[:120]
                first = c.replace("\n", " ")
            items.append({
                "session_id": r["session_id"],
                "first_message": first,
                "message_count": len(msgs),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
                "status": "archived",
            })
        return items



# Global service instanceclass FileService:
class FileService:
    """Unified text extraction for code, Word, Excel, CSV, PDF, and images (OCR)."""

    @staticmethod
    def _detect_mime(file_path: str) -> str:
        """Use libmagic to detect the true MIME type of the file."""
        try:
        
            return magic.from_file(file_path, mime=True)  # e.g. "application/pdf"
        except Exception:
            return "unknown/unknown"
        
    @staticmethod
    def _detect_mime_from_bytes(raw: bytes) -> str:
        """Detect MIME directly from bytes via libmagic; fallback to octet-stream."""
        try:
            m = magic.from_buffer(raw, mime=True)
            return (m or "application/octet-stream").lower()
        except Exception:
            return "application/octet-stream"
    
    @staticmethod
    def _looks_executable_bytes(raw: bytes) -> bool:
        """
        Detect common native executable formats by magic numbers, regardless of filename or MIME.
        """
        if len(raw) < 4:
            return False

        # Windows PE/COFF: "MZ" + later "PE\0\0"
        if raw[:2] == b"MZ":
            return True

        # Linux/Unix ELF: 0x7F 'E' 'L' 'F'
        if raw[:4] == b"\x7fELF":
            return True

        # macOS Mach-O (fat & 32/64-bit variants)
        if raw[:4] in {
            b"\xFE\xED\xFA\xCE",  # Mach-O 32 LE
            b"\xFE\xED\xFA\xCF",  # Mach-O 64 LE
            b"\xCE\xFA\xED\xFE",  # Mach-O 32 BE
            b"\xCF\xFA\xED\xFE",  # Mach-O 64 BE
            b"\xCA\xFE\xBA\xBE",  # Fat binary (old)
            b"\xCA\xFE\xBA\xBF",  # Fat binary (new)
        }:
            return True
        if raw[:2] == b"#!":
            return False
        return False

    @staticmethod
    def _is_dangerous_mime(mime_type: str) -> bool:
        """Block executables and other unsafe binary formats."""
        dangerous_mimes = {
            "application/x-dosexec",    # Windows EXE
            "application/x-executable", # Linux ELF
            "application/x-msdownload", # EXE/DLL
            "application/x-sharedlib",  # Shared libs
            "application/x-object",     # Compiled objects
        }
        return mime_type in dangerous_mimes

    @staticmethod
    def extract_text_content(file_path: str, mime_type: Optional[str] = None) -> str:
        """
        Extract text content from a local file path.
        Heuristics by extension + MIME, with optional library fallbacks.
        """
        try:
            ext = (os.path.splitext(file_path)[1] or "").lower()

            # 0) Detect real MIME (override provided one)
            real_mime = FileService._detect_mime(file_path)

            # Block executables or suspicious binaries
            if FileService._is_dangerous_mime(real_mime):
                return f"[Blocked: file appears to be executable ({real_mime})]"

            # 1) Text/code files (require both extension + MIME to be text-like)
            if FileService._is_texty(real_mime, ext):
                return FileService._read_text(file_path)

            # 2) Structured handlers with MIME double-check
            if ext == ".csv":
                if not real_mime.startswith("text/") and "csv" not in real_mime:
                    return f"[Blocked: {file_path} is not a valid CSV file]"
                return FileService._extract_csv(file_path)

            if ext == ".xlsx":
                if real_mime != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                    return f"[Blocked: {file_path} is not a valid Excel (.xlsx) file]"
                return FileService._extract_xlsx(file_path)

            if ext == ".xls":
                if real_mime not in {"application/vnd.ms-excel", "application/xls"}:
                    return f"[Blocked: {file_path} is not a valid Excel (.xls) file]"
                return FileService._extract_xls(file_path)

            if ext == ".docx":
                if real_mime != "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                    return f"[Blocked: {file_path} is not a valid DOCX file]"
                return FileService._extract_docx(file_path)

            if ext == ".doc":
                if real_mime != "application/msword":
                    return f"[Blocked: {file_path} is not a valid DOC file]"
                return FileService._extract_doc(file_path)

            if ext == ".pdf":
                if real_mime != "application/pdf":
                    return f"[Blocked: {file_path} is not a valid PDF file]"
                return FileService._extract_pdf(file_path)

            if ext in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"}:
                if not real_mime.startswith("image/"):
                    return f"[Blocked: {file_path} is not a valid image file]"
                return FileService._extract_image_ocr(file_path)

            # 3) Last resort: try text read
            return FileService._read_text(file_path)

        except Exception as e:
            logger.error(f"extract_text_content error: {e}")
            return f"[Error extracting text: {e}]"
    
    

    @staticmethod
    def _is_texty(mime_type: Optional[str], ext: str) -> bool:
        text_like_mimes = {
            "text/plain","text/markdown","text/x-python","text/x-c","text/x-c++","text/x-go",
            "text/x-java-source","text/javascript","application/javascript","application/json",
            "application/xml","text/xml","text/css","text/html","application/x-sh",
            "application/x-python","text/yaml","application/yaml","text/csv","application/csv"
        }
        code_exts = {
            ".txt",".md",".rst",".py",".ipynb",".r",".rb",".pl",".php",".js",".mjs",".cjs",
            ".ts",".tsx",".jsx",".java",".kt",".kts",".scala",".go",".c",".h",".cpp",".hpp",
            ".cc",".hh",".cs",".swift",".rs",".sql",".html",".htm",".xml",".xhtml",".css",
            ".sass",".scss",".json",".yaml",".yml",".toml",".ini",".cfg",".sh",".bash",".zsh",
            ".ps1",".bat",".cmd",".gradle",".dockerfile",".env",".csv"
        }
        if mime_type:
            mt = mime_type.lower()
            if mt.startswith("text/") or mt in text_like_mimes:
                return True
        return ext in code_exts
    
    @staticmethod
    async def extract_text_from_bytes(
        file_bytes: bytes,
        mime_type: Optional[str],
        original_name: Optional[str] = None
    ) -> str:
        ext = (os.path.splitext(original_name)[1] or "").lower() if original_name else ""
        real_mime = FileService._detect_mime_from_bytes(file_bytes)

        # Block native executables regardless of name/MIME
        if FileService._looks_executable_bytes(file_bytes):
            return "[Blocked: file appears to be a native executable (PE/ELF/Mach-O)]"

        # Defense-in-depth: MIME blocklist too
        if FileService._is_dangerous_mime(real_mime):
            return f"[Blocked: executable/suspicious MIME detected: {real_mime}]"

        # Fast path for text/code
        if FileService._is_texty(real_mime, ext) or FileService._is_texty(mime_type, ext):
            try:
                return file_bytes.decode("utf-8", errors="replace")
            except Exception:
                return file_bytes.decode("latin-1", errors="replace")

        # Structured/binary → temp + reuse extractors
        suffix = ext if ext else ""
        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(file_bytes)
                temp_file_path = tmp.name
            return FileService.extract_text_content(temp_file_path, mime_type)
        except Exception as e:
            logger.error(f"extract_text_from_bytes error: {e}")
            return f"[Error extracting text: {e}]"
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try: os.remove(temp_file_path)
                except Exception: pass

    @staticmethod
    def _read_text(file_path: str) -> str:
        """Read text safely with UTF-8 first, fallback to latin-1, ignoring errors."""
        try:
            with open(file_path, "r", encoding="utf-8", errors="strict") as f:
                return f.read()
        except Exception:
            try:
                with open(file_path, "r", encoding="latin-1", errors="ignore") as f:
                    return f.read()
            except Exception as e:
                return f"[Error reading as text: {e}]"

    # --- CSV ---

    @staticmethod
    def _extract_csv(file_path: str) -> str:
        try:
            # Return CSV content as tab-separated lines for readability
            out_lines: List[str] = []
            with open(file_path, "r", encoding="utf-8", errors="ignore", newline="") as f:
                reader = csv.reader(f)
                for row in reader:
                    out_lines.append("\t".join(cell if cell is not None else "" for cell in row))
            return "\n".join(out_lines)
        except Exception as e:
            return f"[Error reading CSV: {e}]"

    # --- Excel (.xlsx / .xls) ---

    @staticmethod
    def _extract_xlsx(file_path: str) -> str:
        if load_workbook is None:
            return "[.xlsx extraction requires 'openpyxl' – pip install openpyxl]"
        try:
            wb = load_workbook(filename=file_path, data_only=True, read_only=True)
            chunks: List[str] = []
            for ws in wb.worksheets:
                chunks.append(f"# Sheet: {ws.title}")
                for row in ws.iter_rows(values_only=True):
                    cells = [("" if c is None else str(c)) for c in row]
                    chunks.append("\t".join(cells))
                chunks.append("")  # spacer
            return "\n".join(chunks).strip()
        except Exception as e:
            return f"[Error reading .xlsx: {e}]"

    @staticmethod
    def _extract_xls(file_path: str) -> str:
        if xlrd is None:
            return "[.xls extraction requires 'xlrd' (<=1.2 for xls) – pip install xlrd]"
        try:
            wb = xlrd.open_workbook(file_path)
            chunks: List[str] = []
            for sheet in wb.sheets():
                chunks.append(f"# Sheet: {sheet.name}")
                for r in range(sheet.nrows):
                    row_vals = sheet.row_values(r)
                    cells = [("" if c is None else str(c)) for c in row_vals]
                    chunks.append("\t".join(cells))
                chunks.append("")
            return "\n".join(chunks).strip()
        except Exception as e:
            return f"[Error reading .xls: {e}]"

    # --- Word (.docx / .doc) ---

    @staticmethod
    def _extract_docx(file_path: str) -> str:
        if Document is None:
            return "[.docx extraction requires 'python-docx' – pip install python-docx]"
        try:
            doc = Document(file_path)
            parts: List[str] = []
            # paragraphs
            for p in doc.paragraphs:
                if p.text:
                    parts.append(p.text)
            # tables
            for t in doc.tables:
                for row in t.rows:
                    parts.append("\t".join(cell.text.strip() for cell in row.cells))
            return "\n".join(parts).strip()
        except Exception as e:
            return f"[Error reading .docx: {e}]"

    @staticmethod
    def _extract_doc(file_path: str) -> str:
        # Best attempt: try 'textract' if available
        try:
            import textract  # optional heavy dependency
        except Exception:
            return "[.doc extraction requires 'textract' or a system tool (antiword/catdoc). Install: pip install textract]"
        try:
            raw = textract.process(file_path)
            return raw.decode("utf-8", errors="ignore")
        except Exception as e:
            return f"[Error reading .doc with textract: {e}]"

    # --- PDF ---

    @staticmethod
    def _extract_pdf(file_path: str) -> str:
        if PdfReader is None:
            return "[PDF extraction requires 'pypdf' – pip install pypdf]"
        try:
            reader = PdfReader(file_path)
            texts: List[str] = []
            for i, page in enumerate(reader.pages):
                try:
                    txt = page.extract_text() or ""
                except Exception:
                    txt = ""
                if txt.strip():
                    texts.append(txt)
            if texts:
                return "\n\n".join(texts).strip()
            return "[No extractable text found in PDF (maybe scanned?). Try OCR by converting to image.]"
        except Exception as e:
            return f"[Error reading PDF: {e}]"

    # --- Images (OCR) ---

    @staticmethod
    def _extract_image_ocr(file_path: str) -> str:
        if Image is None or pytesseract is None:
            return "[Image OCR requires 'Pillow' and 'pytesseract' (plus Tesseract installed). pip install pillow pytesseract]"

        # NEW: read from .env
        try:
            tcmd = os.getenv("TESSERACT_CMD")
            if tcmd:
                import pytesseract as _pt
                _pt.pytesseract.tesseract_cmd = tcmd

            # sanity check: raises if not found
            pytesseract.get_tesseract_version()
        except Exception as e:
            return f"[Tesseract not found or misconfigured. Set TESSERACT_CMD in .env. Detail: {e}]"

        try:
            img = Image.open(file_path)
            lang = os.getenv("OCR_LANGS", "eng")
            extra = os.getenv("OCR_CONFIG", "")
            text = pytesseract.image_to_string(img, lang=lang, config=extra)
            return text.strip() or "[No text detected by OCR]"
        except Exception as e:
            return f"[Error performing OCR: {e}]"
code_completion_service = CodeCompletionService()





