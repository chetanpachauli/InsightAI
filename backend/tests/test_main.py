from fastapi.testclient import TestClient
import sys
import os

# Add backend root to path to ensure app imports resolve correctly during CLI tests
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

client = TestClient(app)

def test_read_root():
    """Verify that the base API endpoint responds successfully."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome" in response.json()["message"]
