"""
Shared test fixtures.

Sets up an isolated SQLite database (file-based, since async SQLite in-memory
DBs do not share state across connections), creates tables via the app
lifespan, disables rate limiting for deterministic tests, and provides
authenticated client helpers.
"""
import os
import sys
import tempfile

# Must be set BEFORE importing app (engine is built from settings at import time)
_DB_FILE = os.path.join(tempfile.gettempdir(), "insightai_test.db")
if os.path.exists(_DB_FILE):
    os.remove(_DB_FILE)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_FILE}"
os.environ["JWT_SECRET_KEY"] = "test_secret_key_for_ci_pipeline_only"
os.environ["GEMINI_API_KEY"] = ""
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["RATE_LIMIT_STORAGE"] = "memory://"
os.environ["UPLOAD_DIR"] = os.path.join(tempfile.gettempdir(), "insightai_test_uploads")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import hash_password
from app.core.database import SessionLocal
from app.models.users import User


@pytest.fixture(scope="session")
def client():
    # Disable rate limiting so tests are deterministic
    app.state.limiter.enabled = False

    # Neutralize the ETL background task (Postgres-specific SQL would fail on SQLite)
    import app.api.files as files_api
    import app.api.scraper as scraper_api

    async def _noop_etl(file_id: int) -> None:
        return None

    files_api.run_etl_task = _noop_etl
    scraper_api.run_etl_task = _noop_etl

    with TestClient(app) as c:
        yield c

    # Cleanup test database file (best-effort; may be locked on Windows)
    if os.path.exists(_DB_FILE):
        try:
            os.remove(_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def _clear_cookies(client):
    """Clear the shared TestClient cookie jar between tests so auth state never leaks."""
    yield
    client.cookies.clear()


@pytest.fixture(scope="session")
def db_session():
    import asyncio
    from sqlalchemy import text

    async def _cleanup():
        async with SessionLocal() as session:
            await session.execute(text("DELETE FROM alert_rules"))
            await session.execute(text("DELETE FROM audit_logs"))
            await session.execute(text("DELETE FROM uploaded_files"))
            await session.execute(text("DELETE FROM users"))
            await session.commit()

    yield
    asyncio.run(_cleanup())


def register_user(client, email: str, password: str = "Test@1234", role: str = "Employee"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "role": role},
    )


def login_user(client, email: str, password: str = "Test@1234"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def create_user_and_login(client, email: str, role: str = "Employee", password: str = "Test@1234"):
    """Create a user directly in the DB and return bearer auth headers."""
    import asyncio

    async def _create():
        async with SessionLocal() as session:
            existing = await session.execute(
                __import__("sqlalchemy").future.select(User).where(User.email == email)
            )
            if not existing.scalars().first():
                session.add(User(
                    email=email,
                    hashed_password=hash_password(password),
                    role=role,
                    is_active=True,
                ))
                await session.commit()

    asyncio.run(_create())

    resp = login_user(client, email, password)
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(client):
    return create_user_and_login(client, "admin@test.com", role="Admin")


@pytest.fixture()
def manager_headers(client):
    return create_user_and_login(client, "manager@test.com", role="Manager")


@pytest.fixture()
def mis_headers(client):
    return create_user_and_login(client, "mis@test.com", role="MIS")


@pytest.fixture()
def employee_headers(client):
    return create_user_and_login(client, "employee@test.com", role="Employee")
