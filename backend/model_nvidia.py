import os
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from openai import OpenAI
from dotenv import load_dotenv
from database.schema import ModelConfig


load_dotenv()
logger = logging.getLogger(__name__)

class AIModelClient:
    def __init__(self):
        self.client: Optional[OpenAI] = None
        self.config: Optional[ModelConfig] = None
        self.is_initialized = False
    
    def initialize(self) -> bool:
        """Initialize AI model client with configuration from environment"""
        try:
            # Load configuration from environment
            nvidia_api_key = os.getenv("NVIDIA_API_KEY")
            if not nvidia_api_key:
                logger.error("NVIDIA_API_KEY environment variable is required")
                return False
            
            # Create model configuration
            self.config = ModelConfig(
                name="qwen/qwen2.5-coder-32b-instruct",
                base_url=os.getenv("NVIDIA_BASE_URL"),
                api_key=nvidia_api_key,
                default_temperature=float(os.getenv("DEFAULT_TEMPERATURE")),
                default_top_p=float(os.getenv("DEFAULT_TOP_P")),
                default_max_tokens=int(os.getenv("DEFAULT_MAX_TOKENS")),
                timeout_seconds=int(os.getenv("MODEL_TIMEOUT_SECONDS"))
            )
            
            # Initialize OpenAI client
            self.client = OpenAI(
                base_url=self.config.base_url,
                api_key=self.config.api_key
            )
            
            # Test the client
            if self._test_client():
                self.is_initialized = True
                logger.info("✅ AI Model client initialized successfully")
                return True
            else:
                logger.error("❌ AI Model client test failed")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize AI model client: {e}")
            return False
    
    def _test_client(self) -> bool:
        """Test the AI model client with a simple request"""
        try:
            response = self.client.chat.completions.create(
                model=self.config.name,
                messages=[{"role": "user", "content": "What is 2+2?"}],
                temperature=0.2,
                top_p=0.7,
                max_tokens=50,
                stream=False
            )
            
            test_response = self._safe_get_response_text(response)
            logger.info(f"✅ Client test successful: {test_response[:50]}...")
            return bool(test_response and len(test_response.strip()) > 0)
            
        except Exception as e:
            logger.error(f"Client test failed: {e}")
            return False
    
    def _safe_get_response_text(self, response) -> str:
        """Safely extract text from API response"""
        try:
            if response.choices and len(response.choices) > 0:
                choice = response.choices[0]
                if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                    return choice.message.content
                elif hasattr(choice, 'text'):
                    return choice.text
            
            return "No valid response generated"
            
        except Exception as e:
            logger.warning(f"Error extracting response text: {e}")
            return f"Error extracting response: {str(e)}"
    
    async def generate_chat_response(
        self, 
        messages: List[Dict[str, str]], 
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout: Optional[int] = None
    ) -> str:
        """Generate chat response from messages"""
        if not self.is_initialized:
            raise Exception("AI Model client not initialized")
        
        try:
            # Use config defaults if not specified
            temp = temperature or self.config.default_temperature
            tokens = max_tokens or self.config.default_max_tokens
            timeout_secs = timeout or self.config.timeout_seconds
            
            # Generate response with timeout
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.config.name,
                    messages=messages,
                    temperature=temp,
                    top_p=self.config.default_top_p,
                    max_tokens=tokens,
                    stream=False
                ),
                timeout=timeout_secs
            )
            
            ai_response = self._safe_get_response_text(response)
            
            if not ai_response or "error" in ai_response.lower():
                raise Exception("Model failed to generate valid response")
            
            return ai_response
            
        except asyncio.TimeoutError:
            logger.error("Chat generation timed out")
            raise Exception("Request timed out - please try a shorter message")
        except Exception as e:
            logger.error(f"Chat generation error: {e}")
            raise Exception(f"Chat generation failed: {str(e)}")
    
    async def generate_code_completion(
        self,
        prompt: str,
        language: str = "python",
        temperature: float = 0.1,
        max_tokens: int = 150,
        timeout: Optional[int] = None
    ) -> Tuple[str, bool]:
        """Generate code completion from prompt"""
        if not self.is_initialized:
            raise Exception("AI Model client not initialized")
        
        try:
            timeout_secs = timeout or 10  # Shorter timeout for completions
            
            # Generate completion
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.config.name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    top_p=0.8,
                    max_tokens=max_tokens,
                    stream=False
                ),
                timeout=timeout_secs
            )
            
            completion_text = self._safe_get_response_text(response)
            
            # Check for blocked responses
            blocked_indicators = ['blocked', 'cannot', 'unable', 'sorry', 'error']
            is_blocked = any(indicator in completion_text.lower() for indicator in blocked_indicators)
            
            if is_blocked or not completion_text:
                # Try simpler approach for blocked responses
                logger.warning("Primary completion blocked, trying simpler approach")
                simple_response = await self._generate_simple_completion(prompt, language)
                return simple_response, False
            
            return completion_text, True
            
        except asyncio.TimeoutError:
            logger.warning("Code completion timed out")
            return "", False
        except Exception as e:
            logger.error(f"Code completion error: {e}")
            return "", False
    
    async def _generate_simple_completion(self, prompt: str, language: str) -> str:
        """Generate simple completion for blocked responses"""
        try:
            simple_prompt = f"Complete this {language} code: {prompt[-100:]}"
            
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.config.name,
                    messages=[{"role": "user", "content": simple_prompt}],
                    temperature=0.05,
                    top_p=0.5,
                    max_tokens=50,
                    stream=False
                ),
                timeout=6.0
            )
            
            return self._safe_get_response_text(response)
            
        except Exception as e:
            logger.error(f"Simple completion error: {e}")
            return ""
    
    async def process_file_content(
        self,
        file_content: str,
        prompt: str = "Analyze this file content and provide insights:",
        max_tokens: Optional[int] = None
    ) -> str:
        """Process file content with AI model"""
        if not self.is_initialized:
            raise Exception("AI Model client not initialized")
        
        try:
            # Limit content size to prevent token overflow
            max_content_length = 3000
            if len(file_content) > max_content_length:
                file_content = file_content[:max_content_length] + "\n... (content truncated)"
            
            # Create messages for file processing
            messages = [
                {
                    "role": "system", 
                    "content": "You are an AI assistant that analyzes file content and provides helpful insights, summaries, or answers questions about the content."
                },
                {
                    "role": "user", 
                    "content": f"{prompt}\n\nFile Content:\n{file_content}"
                }
            ]
            
            tokens = max_tokens or 1024
            
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.config.name,
                    messages=messages,
                    temperature=0.7,
                    top_p=0.9,
                    max_tokens=tokens,
                    stream=False
                ),
                timeout=20.0  # Longer timeout for file processing
            )
            
            ai_response = self._safe_get_response_text(response)
            
            if not ai_response or "error" in ai_response.lower():
                raise Exception("Model failed to process file content")
            
            return ai_response
            
        except asyncio.TimeoutError:
            logger.error("File processing timed out")
            raise Exception("File processing timed out - file may be too large")
        except Exception as e:
            logger.error(f"File processing error: {e}")
            raise Exception(f"File processing failed: {str(e)}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model configuration information"""
        if not self.config:
            return {"error": "Model not initialized"}
        
        return {
            "model_name": self.config.name,
            "base_url": self.config.base_url,
            "default_temperature": self.config.default_temperature,
            "default_top_p": self.config.default_top_p,
            "default_max_tokens": self.config.default_max_tokens,
            "timeout_seconds": self.config.timeout_seconds,
            "is_initialized": self.is_initialized
        }

# Global AI model client instance
ai_model = AIModelClient()