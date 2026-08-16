"""Tests for health/root endpoints and global error handling envelope."""
import io


class TestRoot:
    def test_root_ok(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert "message" in body

    def test_health_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"


class TestErrorEnvelope:
    def test_unknown_route_returns_error_envelope(self, client):
        resp = client.get("/does/not/exist")
        assert resp.status_code == 404
        body = resp.json()
        assert "message" in body
        assert "error" in body
        assert "request_id" in body

    def test_validation_error_returns_422_envelope(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"email": "bad", "password": "short", "role": "Employee"},
        )
        assert resp.status_code == 422
        assert "error" in resp.json()

    def test_request_id_header_present(self, client):
        resp = client.get("/")
        assert "x-request-id" in resp.headers
