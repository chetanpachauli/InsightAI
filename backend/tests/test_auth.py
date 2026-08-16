"""Tests for the /api/auth endpoints."""
import pytest


class TestRegister:
    def test_register_employee_success(self, client):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "new@test.com", "password": "Secure@123", "role": "Employee"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == "new@test.com"
        assert body["role"] == "Employee"
        assert body["is_active"] is True
        assert "id" in body
        # Password must never be returned
        assert "hashed_password" not in body
        assert "password" not in body

    def test_register_duplicate_email(self, client, employee_headers):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "employee@test.com", "password": "Secure@123", "role": "Employee"},
        )
        assert resp.status_code == 400
        assert "already exists" in resp.json()["message"]

    def test_register_rejects_admin_role(self, client):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "hacker@test.com", "password": "Secure@123", "role": "Admin"},
        )
        assert resp.status_code == 400
        assert "not allowed" in resp.json()["message"]

    def test_register_rejects_ceo_role(self, client):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "ceo@test.com", "password": "Secure@123", "role": "CEO"},
        )
        assert resp.status_code == 400

    def test_register_invalid_email(self, client):
        resp = client.post(
            "/api/v1/auth/register",
            json={"email": "not-an-email", "password": "Secure@123", "role": "Employee"},
        )
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client, employee_headers):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "employee@test.com", "password": "Test@1234"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["token_type"] == "bearer"
        assert body["role"] == "Employee"
        # Refresh token must be set as HttpOnly cookie
        cookie = resp.cookies.get("refresh_token")
        assert cookie

    def test_login_wrong_password(self, client, employee_headers):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "employee@test.com", "password": "WrongPass!1"},
        )
        assert resp.status_code == 401

    def test_login_unknown_user(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@test.com", "password": "Whatever@1"},
        )
        assert resp.status_code == 401


class TestRefresh:
    def test_refresh_with_cookie(self, client, employee_headers):
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "employee@test.com", "password": "Test@1234"},
        )
        assert login.cookies.get("refresh_token")
        resp = client.post("/api/v1/auth/refresh")
        assert resp.status_code == 200
        assert resp.json()["access_token"]

    def test_refresh_without_cookie(self, client):
        resp = client.post("/api/v1/auth/refresh")
        assert resp.status_code == 401

    def test_refresh_with_garbage_token(self, client):
        client.cookies.set("refresh_token", "garbage.token.value")
        resp = client.post("/api/v1/auth/refresh")
        assert resp.status_code == 401


class TestLogout:
    def test_logout_clears_cookie(self, client, employee_headers):
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "employee@test.com", "password": "Test@1234"},
        )
        assert login.cookies.get("refresh_token")
        resp = client.post("/api/v1/auth/logout")
        assert resp.status_code == 200
        # After logout, refresh should fail
        resp2 = client.post("/api/v1/auth/refresh")
        assert resp2.status_code == 401
