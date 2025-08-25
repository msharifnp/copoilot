import os
import logging
import asyncio
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# Import our modules
from model import ai_model
from redis_client import redis_client
from database.connection import db_client
from copilot.copilot_routers import get_routers
from database.schema import AppConfig, HealthCheckResponse

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Application configuration
config = AppConfig(
    app_name=os.getenv("APP_NAME", "RaaS Chat API with Code Completion"),
    version="2.2.0",
    debug=os.getenv("DEBUG", "false").lower() == "true",
    max_file_size_mb=int(os.getenv("MAX_FILE_SIZE_MB", "10")),
    allowed_file_extensions=os.getenv("ALLOWED_EXTENSIONS", ".txt,.py,.js,.md,.json,.csv,.pdf").split(",")
)

# Create upload directory
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting up {config.app_name} v{config.version}...")
    
    startup_success = True
    
    # Initialize AI Model Client
    logger.info("Initializing AI model client...")
    if not ai_model.initialize():
        logger.error("❌ Failed to initialize AI model client")
        startup_success = False
    logger.info(f"AI Model check complete. startup_success is: {startup_success}")

    # Initialize Redis Connection
    logger.info("Connecting to Redis...")
    if not redis_client.connect():
        logger.warning("⚠️ Redis connection failed - continuing without cache")
        # Optional: you can decide whether cache is critical
        # startup_success = False
    logger.info(f"Redis check complete. startup_success is: {startup_success}")
    
    # Initialize PostgreSQL Connection
    logger.info("Connecting to PostgreSQL...")
    if not await db_client.connect():
        logger.warning("⚠️ PostgreSQL connection failed - continuing without persistence")
        # If DB is critical, flip this to: startup_success = False
        # startup_success = False
    logger.info(f"PostgreSQL connection check complete. startup_success is: {startup_success}")
    
    # No table creation/migration here (tables already exist)

    if not startup_success:
        logger.error("❌ Critical services failed to initialize")
        raise Exception("Application startup failed")
    
    logger.info("✅ Application startup completed successfully")
    yield

    # Shutdown sequence
    logger.info("Shutting down application...")
    if redis_client.is_connected:
        redis_client.disconnect()
        logger.info("Redis connection closed")
    if db_client.is_connected:
        await db_client.disconnect()
        logger.info("PostgreSQL connection closed")
    logger.info("Application shutdown completed")

    # Close Redis connection
    if redis_client.is_connected:
        redis_client.disconnect()
        logger.info("Redis connection closed")
    
    # Close PostgreSQL connection
    if db_client.is_connected:
        await db_client.disconnect()
        logger.info("PostgreSQL connection closed")
    
    logger.info("Application shutdown completed")


# Create FastAPI application
app = FastAPI(
    title=config.app_name,
    description="Advanced Chat API with Code Completion, File Processing, and Multi-language Support",
    version=config.version,
    lifespan=lifespan,
    docs_url="/docs" if config.debug else None,
    redoc_url="/redoc" if config.debug else None
)

# Add middleware to the main app
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url} - {response.status_code} - {process_time:.4f}s")
    return response

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"]
)

# Mount static files for uploads (if needed)
if os.path.exists(UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include all routers
for router in get_routers():
    app.include_router(router)

# Root endpoint
@app.get("/", response_model=HealthCheckResponse)
async def root():
    """Root endpoint with service information"""
    return HealthCheckResponse(
        status="running",
        version=config.version,
        features=["chat", "code_completion", "file_upload", "file_processing", "multi_language_support"],
        model="qwen/qwen2.5-coder-32b-instruct",
        database_connected=db_client.is_connected,
        redis_connected=redis_client.is_connected,
        timestamp=datetime.utcnow()
    )

# Health check endpoint (simplified)
@app.get("/health")
async def health():
    """Simple health check"""
    return {
        "status": "healthy" if ai_model.is_initialized else "degraded",
        "version": config.version,
        "timestamp": datetime.utcnow().isoformat()
    }

# # Global exception handlers
# @app.exception_handler(HTTPException)
# async def http_exception_handler(request: Request, exc: HTTPException):
#     """Handle HTTP exceptions"""
#     from database.schema import ErrorResponse
#     return JSONResponse(
#         status_code=exc.status_code,
#         content=ErrorResponse(
#             error=exc.detail,
#             error_code=f"HTTP_{exc.status_code}",
#             timestamp=datetime.utcnow()
#         ).dict()
#     )
    
    


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    from database.schema import ErrorResponse
    
    # Ensure the timestamp is converted to a string
    error_response_content = ErrorResponse(
        error=exc.detail,
        error_code=f"HTTP_{exc.status_code}",
        timestamp=datetime.utcnow()
    ).dict()
    
    # Convert the datetime object to a string for JSON serialization
    if 'timestamp' in error_response_content and isinstance(error_response_content['timestamp'], datetime):
        error_response_content['timestamp'] = error_response_content['timestamp'].isoformat()
        
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response_content
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    from database.schema import ErrorResponse
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            error_code="INTERNAL_ERROR",
            details={"exception_type": type(exc).__name__},
            timestamp=datetime.utcnow()
        ).dict() if config.debug else {
            "error": "Internal server error",
            "error_code": "INTERNAL_ERROR",
            "timestamp": datetime.utcnow().isoformat()
        }
    )
    

# Run the application
if __name__ == "__main__":
    import uvicorn
    
    # Configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    workers = int(os.getenv("WORKERS", "1"))
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        log_level=log_level,
        workers=workers if workers > 1 else None,
        reload=config.debug,
        access_log=config.debug
    )