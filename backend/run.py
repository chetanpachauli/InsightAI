import sys
import os
import uvicorn
from dotenv import load_dotenv

# Resolve the backend directory path (current folder of this script)
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_path)

# Resolve parent directory to load .env safely
parent_dir = os.path.dirname(backend_path)
dotenv_path = os.path.join(parent_dir, ".env")

if __name__ == "__main__":
    # Load secrets from parent .env (if present). Real env vars always win.
    load_dotenv(dotenv_path)

    # NOTE: Never override DATABASE_URL / REDIS_URL here. Local dev relies on
    # the defaults in app/core/config.py, while production (Render) provides
    # these as real environment variables. Hardcoding localhost here silently
    # breaks production deployments (see git history for the original bug).

    print("\n" + "="*50)
    print("Starting InsightAI FastAPI Backend from backend/ folder...")
    print("API Endpoints: http://127.0.0.1:8000")
    print("Swagger docs:  http://127.0.0.1:8000/docs")
    print("="*50 + "\n")

    # Bind to the port provided by the environment (Render) or 8000 locally.
    # reload is only safe for local development.
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", 8000)),
        reload=os.environ.get("RELOAD", "true").lower() == "true",
    )
