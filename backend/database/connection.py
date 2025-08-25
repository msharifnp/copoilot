import asyncpg
import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv()
logger = logging.getLogger(__name__)

class PostgreSQLConnection:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.is_connected = False
    
    async def connect(self) -> bool:
        """Initialize PostgreSQL connection pool with credentials from .env"""
        try:
            pg_host = os.getenv("POSTGRES_HOST")
            pg_port = int(os.getenv("POSTGRES_PORT"))
            pg_user = os.getenv("POSTGRES_USER")
            pg_password = os.getenv("POSTGRES_PASSWORD")
            pg_database = os.getenv("POSTGRES_DB")
            
            # Connection string
            dsn = f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}"
            
            # Create connection pool
            self.pool = await asyncpg.create_pool(
                dsn,
                min_size=1,
                max_size=10,
                command_timeout=60,
                server_settings={
                    'jit': 'off'
                }
            )
            
            # Test connection
            async with self.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            
            self.is_connected = True
            logger.info("✅ PostgreSQL connected successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ PostgreSQL connection failed: {e}")
            self.pool = None
            self.is_connected = False
            return False
    
    async def disconnect(self):
        """Close PostgreSQL connection pool"""
        if self.pool:
            try:
                await self.pool.close()
                logger.info("PostgreSQL connection pool closed")
            except Exception as e:
                logger.warning(f"Error closing PostgreSQL pool: {e}")
        self.is_connected = False
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection from pool"""
        if not self.pool:
            raise Exception("Database not connected")
        
        conn = await self.pool.acquire()
        try:
            yield conn
        finally:
            await self.pool.release(conn)
    
    # Basic database operations
    async def execute_query(self, query: str, *args) -> List[Dict[str, Any]]:
        """Execute SELECT query and return results as list of dicts"""
        try:
            async with self.get_connection() as conn:
                rows = await conn.fetch(query, *args)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Query execution error: {e}")
            return []
    
    async def execute_command(self, command: str, *args) -> bool:
        """Execute INSERT/UPDATE/DELETE command (auto-JSON encode dict/list args)."""
        try:
            async with self.get_connection() as conn:
                norm_args = [
                    json.dumps(a) if isinstance(a, (dict, list)) else a
                    for a in args
                ]
                await conn.execute(command, *norm_args)
                return True
        except Exception as e:
            logger.error(f"Command execution error: {e}")
        return False

    
    async def fetch_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Fetch single row"""
        try:
            async with self.get_connection() as conn:
                row = await conn.fetchrow(query, *args)
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Fetch one error: {e}")
            return None
    
    async def execute_transaction(self, commands: List[tuple]) -> bool:
        """Execute multiple commands in a transaction"""
        try:
            async with self.get_connection() as conn:
                async with conn.transaction():
                    for command, args in commands:
                        await conn.execute(command, *args)
                return True
        except Exception as e:
            logger.error(f"Transaction error: {e}")
            return False
        
    
    async def save_chat_session(self, session_id: str, messages, user_id: str) -> bool:
        sql = """
        INSERT INTO public.chat_sessions (session_id, user_id, metadata, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE
        SET metadata   = EXCLUDED.metadata,
            user_id    = COALESCE(EXCLUDED.user_id, public.chat_sessions.user_id),
            updated_at = NOW();
        """
        metadata = {"messages": messages, "message_count": len(messages)}
        # IMPORTANT: ::jsonb expects a JSON string, not a Python dict
        return await self.execute_command(sql, session_id, user_id, json.dumps(metadata))


    # --- LOAD: always return a dict with "messages" & "message_count" ---
    async def get_chat_session(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        row = await self.fetch_one(
            """
            SELECT session_id, user_id, metadata, created_at, updated_at
            FROM public.chat_sessions
            WHERE session_id = $1 AND user_id = $2
            """,
            session_id, user_id
        )
        if not row:
            return None

        # asyncpg returns jsonb as Python dict by default; handle fallbacks safely
        md = row.get("metadata")
        if isinstance(md, str):
            try:
                md = json.loads(md)
            except Exception:
                md = {}
        if not isinstance(md, dict):
            md = {}

        msgs = md.get("messages")
        if not isinstance(msgs, list):
            msgs = []

        row["messages"] = msgs
        row["message_count"] = (md.get("message_count")
                                if isinstance(md.get("message_count"), int)
                                else len(msgs))
        # Optional: hide raw metadata if you want
        # row.pop("metadata", None)

        return row


    
    # --- list sessions for sidebar/history (lightweight) ---
    async def get_user_chat_sessions(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Return lightweight rows for the sidebar: first_message preview and message_count,
        computed directly in SQL from metadata->'messages'.
        """
        rows = await self.execute_query(
            """
            SELECT
                session_id,
                user_id,
                created_at,
                updated_at,
                -- count messages directly in SQL (0 if missing)
                COALESCE(jsonb_array_length(metadata->'messages'), 0) AS message_count,
                -- first message content preview (empty if none)
                LEFT(COALESCE((metadata->'messages'->0->>'content'), ''), 10) AS first_message
            FROM public.chat_sessions
            WHERE user_id = $1
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT $2 OFFSET $3
            """,
            user_id, limit, offset
        )
        return rows


# Global PostgreSQL instance
db_client = PostgreSQLConnection()