"""Tests for the /api/rules endpoints (CRUD + ownership enforcement)."""

RULE_PAYLOAD = {
    "name": "Low Stock Alert",
    "rule_type": "CUSTOM",
    "condition_col": "stock_qty",
    "operator": "<",
    "value": "10",
    "action_type": "ALERT",
    "recipient": "ops@test.com",
}


class TestCreateRule:
    def test_employee_cannot_create(self, client, employee_headers):
        resp = client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=employee_headers)
        assert resp.status_code == 403

    def test_manager_can_create(self, client, manager_headers):
        resp = client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=manager_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Low Stock Alert"
        assert body["is_active"] is True

    def test_list_rules(self, client, manager_headers):
        client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=manager_headers)
        resp = client.get("/api/v1/rules", headers=manager_headers)
        assert resp.status_code == 200
        assert any(r["name"] == "Low Stock Alert" for r in resp.json())


class TestToggleRule:
    def test_toggle_rule(self, client, manager_headers):
        created = client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=manager_headers).json()
        resp = client.post(f"/api/v1/rules/{created['id']}/toggle", headers=manager_headers)
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
        # Toggle back
        resp2 = client.post(f"/api/v1/rules/{created['id']}/toggle", headers=manager_headers)
        assert resp2.json()["is_active"] is True

    def test_other_user_cannot_toggle(self, client, manager_headers, mis_headers):
        created = client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=manager_headers).json()
        resp = client.post(f"/api/v1/rules/{created['id']}/toggle", headers=mis_headers)
        assert resp.status_code == 403

    def test_toggle_missing_rule(self, client, admin_headers):
        resp = client.post("/api/v1/rules/99999/toggle", headers=admin_headers)
        assert resp.status_code == 404


class TestDeleteRule:
    def test_delete_own_rule(self, client, manager_headers):
        created = client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=manager_headers).json()
        resp = client.delete(f"/api/v1/rules/{created['id']}", headers=manager_headers)
        assert resp.status_code == 204

    def test_admin_can_delete_others(self, client, manager_headers, admin_headers):
        created = client.post("/api/v1/rules", json=RULE_PAYLOAD, headers=manager_headers).json()
        resp = client.delete(f"/api/v1/rules/{created['id']}", headers=admin_headers)
        assert resp.status_code == 204
