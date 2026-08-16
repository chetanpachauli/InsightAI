"""Tests for the /api/query endpoints (chat, raw-data, insights, stats)."""
import io

import pytest


def create_approved_file(client, mis_headers, admin_headers):
    """Upload via MIS, then approve via Admin so the dataset is queryable."""
    resp = client.post(
        "/api/v1/files/upload",
        files={"file": ("sales_data.csv", io.BytesIO(
            b"date,region,product,sales\n2024-01-01,North,Widget,100\n"
        ), "text/csv")},
        headers=mis_headers,
    )
    assert resp.status_code == 201
    file_id = resp.json()["id"]
    approved = client.post(f"/api/v1/files/{file_id}/approve", headers=admin_headers)
    assert approved.status_code == 200
    return file_id


class TestStats:
    def test_stats_requires_auth(self, client):
        resp = client.get("/api/v1/query/stats")
        assert resp.status_code == 401

    def test_stats_returns_counts(self, client, employee_headers, mis_headers, admin_headers):
        create_approved_file(client, mis_headers, admin_headers)
        resp = client.get("/api/v1/query/stats", headers=employee_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_files"] >= 1
        assert body["total_approved"] >= 1
        assert isinstance(body["recent_logs"], list)

    def test_stats_limit_clamped(self, client, employee_headers):
        resp = client.get("/api/v1/query/stats?limit=9999", headers=employee_headers)
        assert resp.status_code == 200
        assert len(resp.json()["recent_logs"]) <= 100


class TestRawData:
    def test_raw_data_requires_auth(self, client):
        resp = client.post("/api/v1/query/raw-data", json={"table_name": "foo"})
        assert resp.status_code == 401

    def test_raw_data_rejects_injection(self, client, employee_headers):
        resp = client.post(
            "/api/v1/query/raw-data",
            json={"table_name": "x; DROP TABLE users; --"},
            headers=employee_headers,
        )
        assert resp.status_code == 400

    def test_raw_data_unapproved_table_forbidden(self, client, employee_headers):
        resp = client.post(
            "/api/v1/query/raw-data",
            json={"table_name": "data_secret_v1"},
            headers=employee_headers,
        )
        assert resp.status_code == 403


class TestInsights:
    def test_insights_empty_system(self, client, employee_headers):
        resp = client.get("/api/v1/query/insights", headers=employee_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert any("No approved" in finding for finding in body["key_findings"])


class TestChat:
    def test_chat_no_approved_files(self, client, employee_headers):
        resp = client.post(
            "/api/v1/query/chat",
            json={"question": "Show total sales"},
            headers=employee_headers,
        )
        assert resp.status_code == 400
        assert "No files have been approved" in resp.json()["message"]
