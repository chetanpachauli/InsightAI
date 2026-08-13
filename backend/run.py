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
    # Load secrets from parent .env
    load_dotenv(dotenv_path)
    
    # Configure database and cache URLs to point to localhost on the host machine
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/insightai"
    os.environ["REDIS_URL"] = "redis://localhost:6379/0"
    
    print("\n" + "="*50)
    print("🚀 Starting InsightAI FastAPI Backend from backend/ folder...")
    print("👉 API Endpoints: http://127.0.0.1:8000")
    print("👉 Swagger docs:  http://127.0.0.1:8000/docs")
    print("="*50 + "\n")
    
    # Run uvicorn server in reload mode from backend directory
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
