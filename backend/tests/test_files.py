"""Tests for file upload, approval workflow, lineage, and deletion."""
import io
import os

import pytest

CSV_CONTENT = b"date,region,product,sales\n2024-01-01,North,Widget,100\n2024-01-02,South,Widget,150\n"


def upload_csv(client, headers, filename="sales_data.csv"):
    return client.post(
        "/api/files/upload",
        files={"file": (filename, io.BytesIO(CSV_CONTENT), "text/csv")},
        headers=headers,
    )


class TestUpload:
    def test_upload_as_mis_success(self, client, mis_headers):
        resp = upload_csv(client, mis_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["filename"] == "sales_data.csv"
        assert body["version"] == 1
        assert body["status"] == "PENDING"
        assert body["workflow_status"] == "DRAFT"
        assert body["lineage_info"]["action"] == "UPLOAD"

    def test_upload_as_employee_forbidden(self, client, employee_headers):
        resp = upload_csv(client, employee_headers)
        assert resp.status_code == 403

    def test_upload_invalid_extension(self, client, mis_headers):
        resp = client.post(
            "/api/files/upload",
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
            headers=mis_headers,
        )
        assert resp.status_code == 400

    def test_upload_unauthenticated(self, client):
        resp = upload_csv(client, {})
        assert resp.status_code == 401


class TestListFiles:
    def test_list_files_requires_auth(self, client):
        resp = client.get("/api/files")
        assert resp.status_code == 401

    def test_list_files_shows_uploaded(self, client, mis_headers):
        upload_csv(client, mis_headers)
        resp = client.get("/api/files", headers=mis_headers)
        assert resp.status_code == 200
        files = resp.json()
        assert any(f["filename"] == "sales_data.csv" for f in files)


class TestApprovalWorkflow:
    def _upload_and_get_id(self, client, mis_headers):
        resp = upload_csv(client, mis_headers)
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_manager_reviews_draft(self, client, mis_headers, manager_headers):
        file_id = self._upload_and_get_id(client, mis_headers)
        resp = client.post(f"/api/files/{file_id}/approve", headers=manager_headers)
        assert resp.status_code == 200
        assert resp.json()["workflow_status"] == "REVIEWED"

    def test_manager_cannot_approve_draft(self, client, mis_headers, manager_headers):
        file_id = self._upload_and_get_id(client, mis_headers)
        resp = client.post(f"/api/files/{file_id}/approve", headers=manager_headers)
        assert resp.status_code == 200
        # Second manager action on REVIEWED file should fail
        resp2 = client.post(f"/api/files/{file_id}/approve", headers=manager_headers)
        assert resp2.status_code == 400

    def test_admin_approves_to_approved(self, client, mis_headers, admin_headers):
        file_id = self._upload_and_get_id(client, mis_headers)
        resp = client.post(f"/api/files/{file_id}/approve", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["workflow_status"] == "APPROVED"

    def test_employee_cannot_approve(self, client, mis_headers, employee_headers):
        file_id = self._upload_and_get_id(client, mis_headers)
        resp = client.post(f"/api/files/{file_id}/approve", headers=employee_headers)
        assert resp.status_code == 403


class TestLineage:
    def test_get_lineage(self, client, mis_headers):
        resp = upload_csv(client, mis_headers)
        file_id = resp.json()["id"]
        lineage = client.get(f"/api/files/{file_id}/lineage", headers=mis_headers)
        assert lineage.status_code == 200
        body = lineage.json()
        assert body["file_details"]["id"] == file_id
        assert body["raw_lineage"]["action"] == "UPLOAD"
        assert any(a["action"] == "FILE_UPLOAD" for a in body["audit_trail"])


class TestDelete:
    def test_delete_file(self, client, mis_headers):
        resp = upload_csv(client, mis_headers)
        file_id = resp.json()["id"]
        deleted = client.delete(f"/api/files/{file_id}", headers=mis_headers)
        assert deleted.status_code == 200
        # File should be gone
        listing = client.get("/api/files", headers=mis_headers).json()
        assert not any(f["id"] == file_id for f in listing)

    def test_employee_cannot_delete(self, client, mis_headers, employee_headers):
        resp = upload_csv(client, mis_headers)
        file_id = resp.json()["id"]
        deleted = client.delete(f"/api/files/{file_id}", headers=employee_headers)
        assert deleted.status_code == 403
