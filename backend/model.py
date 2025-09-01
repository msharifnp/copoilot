import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple, TYPE_CHECKING
from dotenv import load_dotenv
import google.generativeai as genai
from database.schema import ModelConfig 
from database.schema import ModelConfig as RuntimeModelConfig
load_dotenv()
logger = logging.getLogger("model")


# if TYPE_CHECKING:
#     from database.schema import ModelConfig  # noqa: F401

# logger = logging.getLogger("model")


class AIModelClient:
    """
    Gemini-backed client that preserves your app interface:
      - initialize()
      - generate_chat_response(...)
      - generate_code_completion(...)
      - process_file_content(...)
      - get_model_info()
    """

    def __init__(self):
        self.is_initialized: bool = False
        self._model = None
        self.config: Optional["ModelConfig"] = None  # forward ref keeps Pylance happy

        # Read all configuration from .env file
        self._default_temperature = float(os.getenv("DEFAULT_TEMPERATURE"))
        self._default_top_p = float(os.getenv("DEFAULT_TOP_P"))
        self._default_max_tokens = int(os.getenv("DEFAULT_MAX_TOKENS"))
        self._default_timeout = int(os.getenv("MODEL_TIMEOUT_SECONDS"))
        
        # Code completion specific settings (clamped to limits)
        self._code_temperature = float(os.getenv("CODE_COMPLETION_TEMPERATURE"))
        self._code_max_tokens = int(os.getenv("CODE_COMPLETION_MENU_MAX_TOKENS"))
        self._code_timeout = int(os.getenv("CODE_COMPLETION_TIMEOUT"))
        
        # File processing settings (clamped to limits)
        self._file_temperature = float(os.getenv("FILE_PROCESSING_TEMPERATURE"))
        self._file_max_tokens = int(os.getenv("FILE_PROCESSING_MAX_TOKENS"))
        self._file_timeout = int(os.getenv("FILE_PROCESSING_TIMEOUT"))

        # Model + key from env
        self._model_name = os.getenv("GEMINI_MODEL")
        self._api_key = os.getenv("GEMINI_API_KEY")
        
        # Log the effective non-sensitive config
        logger.info(
            "Model config -> model=%s temp=%.3f max_tokens=%d timeout=%ds",
            self._model_name, self._default_temperature,
            self._default_max_tokens, self._default_timeout
        )

    # ---------- Initialization ----------

    def initialize(self) -> bool:
        """Initialize Gemini client and construct ModelConfig safely."""
        try:
            if not self._api_key:
                logger.error("GEMINI_API_KEY is required")
                return False

            genai.configure(api_key=self._api_key)
            self._model = genai.GenerativeModel(self._model_name)

            # Build ModelConfig at runtime if available (use raw values from env)
            # try:
            #     from database.schema import ModelConfig as RuntimeModelConfig
            # except Exception:
            #     RuntimeModelConfig = None

            if RuntimeModelConfig is not None:
                # Skip ModelConfig validation - just store values for info purposes
                try:
                    self.config = RuntimeModelConfig(
                        name=self._model_name,
                        base_url="google",
                        api_key="***",  # never log real keys
                        default_temperature=self._default_temperature,
                        default_top_p=self._default_top_p,
                        default_max_tokens=self._default_max_tokens,
                        timeout_seconds=self._default_timeout,
                    )
                except Exception as config_error:
                    # If ModelConfig validation fails, continue without it
                    logger.warning("ModelConfig validation failed, continuing without config object: %s", config_error)
                    self.config = None

            # Smoke test (non-fatal)
            try:
                resp = self._model.generate_content("Answer only: 2 + 2 = ?")
                txt = (getattr(resp, "text", "") or "").strip()
                logger.info("✅ Client test successful: %s", txt[:16])
            except Exception as e:
                logger.warning("Gemini smoke test failed (continuing): %s", e)

            self.is_initialized = True
            logger.info("✅ AI Model client initialized successfully")
            return True

        except Exception as e:
            logger.error("❌ Failed to initialize AI model client: %s", e)
            self.is_initialized = False
            return False

    # ---------- Helpers ----------

    def _flatten_messages(self, messages: List[Dict[str, str]]) -> str:
        """Convert OpenAI-style messages into a single prompt for Gemini."""
        parts: List[str] = []
        has_system = False
        for m in messages or []:
            role = (m.get("role") or "user").lower()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                parts.append(f"[System]\n{content}\n")
                has_system = True
            elif role == "assistant":
                parts.append(f"[Assistant]\n{content}\n")
            else:
                parts.append(f"[User]\n{content}\n")
        if not has_system:
            parts.insert(0, "[System]\nYou are a helpful coding assistant.\n")
        return "\n".join(parts).strip()

    def _extract_text(self, resp) -> str:
        """Safely get text from a google-generativeai response."""
        text = (getattr(resp, "text", "") or "").strip()
        if text:
            return text
        try:
            if getattr(resp, "candidates", None):
                return resp.candidates[0].content.parts[0].text.strip()
        except Exception:
            pass
        return ""

    # ---------- Public API ----------

    async def generate_chat_response(self, messages: List[Dict[str, str]]) -> str:
        """Generate chat response using default settings from .env"""
        if not self.is_initialized and not self.initialize():
            raise RuntimeError("Model not initialized")

        prompt = self._flatten_messages(messages)

        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    self._model.generate_content,
                    prompt,
                    generation_config={
                        "temperature": self._default_temperature,
                        "max_output_tokens": self._default_max_tokens,
                    },
                ),
                timeout=self._default_timeout,
            )
            text = self._extract_text(resp)
            if not text:
                raise RuntimeError("Model failed to generate valid response")
            return text

        except asyncio.TimeoutError:
            logger.error("Chat generation timed out")
            raise RuntimeError("Request timed out - please try a shorter message")
        except Exception as e:
            logger.error("Chat generation error: %s", e)
            raise RuntimeError("Model failed to generate valid response")

    async def generate_code_completion(self, prompt: str, language: str = "python") -> Tuple[str, bool]:
        """Generate code completion for any programming language using .env settings"""
        if not self.is_initialized and not self.initialize():
            return "", False

        # Enhanced prompt for better code completion across all languages
        language_prompts = {
            "python": f"Complete this Python code:\n\n{prompt}",
            "java": f"Complete this Java code:\n\n{prompt}",
            "javascript": f"Complete this JavaScript code:\n\n{prompt}",
            "typescript": f"Complete this TypeScript code:\n\n{prompt}",
            "csharp": f"Complete this C# code:\n\n{prompt}",
            "c#": f"Complete this C# code:\n\n{prompt}",
            "sql": f"Complete this SQL query:\n\n{prompt}",
            "html": f"Complete this HTML code:\n\n{prompt}",
            "css": f"Complete this CSS code:\n\n{prompt}",
            "go": f"Complete this Go code:\n\n{prompt}",
            "rust": f"Complete this Rust code:\n\n{prompt}",
            "php": f"Complete this PHP code:\n\n{prompt}",
            "ruby": f"Complete this Ruby code:\n\n{prompt}",
            "cpp": f"Complete this C++ code:\n\n{prompt}",
            "c++": f"Complete this C++ code:\n\n{prompt}",
            "c": f"Complete this C code:\n\n{prompt}",
            "kotlin": f"Complete this Kotlin code:\n\n{prompt}",
            "swift": f"Complete this Swift code:\n\n{prompt}",
            "dart": f"Complete this Dart code:\n\n{prompt}",
            "scala": f"Complete this scala code:\n\n{prompt}"
        }
        
        completion_prompt = language_prompts.get(language.lower(), f"Complete this {language} code:\n\n{prompt}")

        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    self._model.generate_content,
                    completion_prompt,
                    generation_config={
                        "temperature": self._code_temperature,
                        "max_output_tokens": self._code_max_tokens,
                    },
                ),
                timeout=self._code_timeout,
            )
            text = self._extract_text(resp)
            blocked_indicators = ("blocked", "cannot", "unable", "sorry", "error")
            is_blocked = any(k in (text or "").lower() for k in blocked_indicators)

            if not text or is_blocked:
                logger.warning("Primary completion blocked/empty, trying simpler approach")
                simple = await self._generate_simple_completion(prompt, language)
                return simple, False

            return text, True

        except asyncio.TimeoutError:
            logger.warning("Code completion timed out")
            return "", False
        except Exception as e:
            logger.error("Code completion error: %s", e)
            return "", False

    # async def _generate_simple_completion(self, prompt: str, language: str) -> str:
    #     """Fallback simple completion"""
    #     try:
    #         simple_prompt = f"Complete this {language} code (only provide the completion):\n\n{prompt[-200:]}"
    #         resp = await asyncio.wait_for(
    #             asyncio.to_thread(
    #                 self._model.generate_content,
    #                 simple_prompt,
    #                 generation_config={
    #                     "temperature": 0.05,
    #                     "max_output_tokens": min(int(os.getenv("SIMPLE_COMPLETION_MAX_TOKENS")), self._code_max_tokens),
    #                 },
    #             ),
    #             timeout=min(int(os.getenv("SIMPLE_COMPLETION_TIMEOUT")), self._code_timeout),
    #         )
    #         return self._extract_text(resp)
    #     except Exception as e:
    #         logger.error("Simple completion error: %s", e)
    #         return ""

    async def process_file_content(self, file_content: str, prompt: str = "Analyze this file content and provide insights:") -> str:
        """Process file content using .env settings"""
        if not self.is_initialized and not self.initialize():
            raise RuntimeError("Model not initialized")

        max_content_length = int(os.getenv("MAX_FILE_CONTENT_LENGTH"))
        if len(file_content) > max_content_length:
            file_content = file_content[:max_content_length] + "\n... (content truncated)"

        messages = [
            {"role": "system", "content": "You are an AI assistant that analyzes file content and provides helpful insights, summaries, or answers questions about the content."},
            {"role": "user", "content": f"{prompt}\n\nFile Content:\n{file_content}"},
        ]
        flat = self._flatten_messages(messages)

        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    self._model.generate_content,
                    flat,
                    generation_config={
                        "temperature": self._file_temperature,
                        "max_output_tokens": self._file_max_tokens,
                    },
                ),
                timeout=self._file_timeout,
            )
            text = self._extract_text(resp)
            if not text:
                raise RuntimeError("Model failed to process file content")
            return text

        except asyncio.TimeoutError:
            logger.error("File processing timed out")
            raise RuntimeError("File processing timed out - file may be too large")
        except Exception as e:
            logger.error("File processing error: %s", e)
            raise RuntimeError("File processing failed: Model failed to generate valid response")

    def get_model_info(self) -> Dict[str, Any]:
        """Get model configuration info"""
        if self.config is not None:
            return {
                "model_name": self.config.name,
                "base_url": self.config.base_url,
                "default_temperature": self.config.default_temperature,
                "default_top_p": self.config.default_top_p,
                "default_max_tokens": self.config.default_max_tokens,
                "timeout_seconds": self.config.timeout_seconds,
                "code_temperature": self._code_temperature,
                "code_max_tokens": self._code_max_tokens,
                "code_timeout": self._code_timeout,
                "file_temperature": self._file_temperature,
                "file_max_tokens": self._file_max_tokens,
                "file_timeout": self._file_timeout,
                "is_initialized": self.is_initialized,
            }
        return {
            "model_name": self._model_name,
            "base_url": "google",
            "default_temperature": self._default_temperature,
            "default_top_p": self._default_top_p,
            "default_max_tokens": self._default_max_tokens,
            "timeout_seconds": self._default_timeout,
            "code_temperature": self._code_temperature,
            "code_max_tokens": self._code_max_tokens,
            "code_timeout": self._code_timeout,
            "file_temperature": self._file_temperature,
            "file_max_tokens": self._file_max_tokens,
            "file_timeout": self._file_timeout,
            "is_initialized": self.is_initialized,
        }


# Global singleton used by the rest of the app
ai_model = AIModelClient()