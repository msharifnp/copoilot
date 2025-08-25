import os
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

# Optional: load .env (harmless if not installed)
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import redis

logger = logging.getLogger(__name__)


class RedisConnection:
    
    def __init__(self):
        self.client: Optional[redis.Redis] = None
        self.is_connected = False

        # TTL for chat sessions (seconds)
        self.chat_ttl = int(os.getenv("REDIS_CHAT_TTL_SECONDS"))

        # Keep at most N messages per session in Redis (trim older ones)
        self.chat_max_history = int(os.getenv("CHAT_MAX_HISTORY"))

        # Connection pool size
        self.max_connections = int(os.getenv("REDIS_MAX_CONNECTIONS"))

    
    # Connection management
    
    def connect(self) -> bool:
        """Initialize Redis connection using .env credentials."""
        try:
            redis_host = os.getenv("REDIS_HOST")
            redis_port = int(os.getenv("REDIS_PORT"))
            redis_user = os.getenv("REDIS_USER")
            redis_password = os.getenv("REDIS_PASSWORD")
            redis_db = int(os.getenv("REDIS_DB"))

            self.client = redis.Redis(
                host=redis_host,
                port=redis_port,
                username=redis_user,
                password=redis_password,
                db=redis_db,
                decode_responses=True,  # store/read strings
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                max_connections=self.max_connections,
            )

            # Sanity check
            self.client.ping()
            self.is_connected = True
            logger.info("✅ Redis connected successfully")
            return True

        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed: {e}")
            self.client = None
            self.is_connected = False
            return False

    def disconnect(self):
        """Close Redis connection."""
        if self.client:
            try:
                self.client.close()
                logger.info("Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
        self.is_connected = False

    def get_client(self) -> Optional[redis.Redis]:
        """Return the raw Redis client if connected."""
        return self.client if self.is_connected else None

 
    # Keys & basic KV helpers
    
    def _chat_key(self, session_id: str, user_id: Optional[str] = None) -> str:
        """Consistent key format; pass user_id to avoid cross-user collisions."""
        return f"chat:{user_id}:{session_id}" if user_id else f"chat:{session_id}"

    def set_with_expiry(self, key: str, value: str, expiry: int = 3600) -> bool:
        """SET key with expiry (seconds)."""
        try:
            if self.client:
                self.client.setex(key, expiry, value)
                return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
        return False

    def get(self, key: str) -> Optional[str]:
        """GET key (string)."""
        try:
            if self.client:
                return self.client.get(key)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
        return None

    def delete(self, key: str) -> bool:
        """DEL key."""
        try:
            if self.client:
                return bool(self.client.delete(key))
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
        return False

    
    # Chat-centric helpers (core API)
    
    def add_chat_message(
        self,
        session_id: str,
        role: str,
        content: str,
        user_id: Optional[str] = None,
    ) -> bool:
        """
        Append a message to the session list (LPUSH newest), trim to max_history,
        and refresh TTL so the session stays alive while active.
        """
        if not self.is_connected or not self.client:
            return False

        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(timespec="seconds"),
            "user_id": user_id,
        }

        key = self._chat_key(session_id, user_id)
        try:
            pipe = self.client.pipeline(True)
            pipe.lpush(key, json.dumps(message))               # newest → left
            if self.chat_max_history and self.chat_max_history > 0:
                pipe.ltrim(key, 0, self.chat_max_history - 1)  # keep last N (by index)
            pipe.expire(key, self.chat_ttl)                    # refresh TTL
            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"Redis add_chat_message error: {e}")
            return False

    def get_chat_messages(
        self,
        session_id: str,
        user_id: Optional[str] = None,
        *,
        limit: Optional[int] = None,
        oldest_first: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Fetch messages for a session.

        We LPUSH (newest → left). LRANGE returns [newest ... oldest].
        For chronological order, reverse the list unless oldest_first=False.
        `limit`: if provided, return only the last N chronologically.
        """
        if not self.is_connected or not self.client:
            return []

        key = self._chat_key(session_id, user_id)
        try:
            raw = self.client.lrange(key, 0, -1)  # newest → oldest
            msgs: List[Dict[str, Any]] = []
            for item in raw:
                try:
                    msgs.append(json.loads(item))
                except Exception:
                    # skip malformed entries
                    continue

            if oldest_first:
                msgs.reverse()  # oldest → newest

            if limit is not None and limit > 0:
                msgs = msgs[-limit:]

            return msgs
        except Exception as e:
            logger.error(f"Redis get_chat_messages error: {e}")
            return []

    def get_session_message_count(self, session_id: str, user_id: Optional[str] = None) -> int:
        """Return number of messages stored for this session."""
        if not self.is_connected or not self.client:
            return 0
        try:
            key = self._chat_key(session_id, user_id)
            return int(self.client.llen(key) or 0)
        except Exception as e:
            logger.error(f"Redis LLEN error: {e}")
            return 0

    def clear_chat_cache(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """Remove a session’s cached list entirely."""
        if not self.is_connected or not self.client:
            return False
        try:
            key = self._chat_key(session_id, user_id)
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DEL error: {e}")
            return False

    def load_chat_to_cache(
        self,
        session_id: str,
        messages: List[Dict[str, Any]], *,
        user_id: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> int:
        """
        Replace cache with the provided chronological `messages`
        (e.g., loaded from Postgres). Uses RPUSH to preserve order.
        """
        if not self.is_connected or not self.client:
            return False

        key = self._chat_key(session_id, user_id)
        try:
            pipe = self.client.pipeline(True)
            pipe.delete(key)
            for m in messages:
                pipe.rpush(key, json.dumps(m))      # chronological append
            pipe.expire(key, int(ttl or self.chat_ttl))
            pipe.execute()
            return True
        except Exception as e:
            logger.error(f"Redis load_chat_to_cache error: {e}")
            return False

    def session_exists_in_cache(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """True if the session key currently exists in cache."""
        if not self.is_connected or not self.client:
            return False
        try:
            key = self._chat_key(session_id, user_id)
            return bool(self.client.exists(key))
        except Exception as e:
            logger.error(f"Redis EXISTS error: {e}")
            return False


# Global singleton
redis_client = RedisConnection()
