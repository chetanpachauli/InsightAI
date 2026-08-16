def test_read_root(client):
    """Verify that the base API endpoint responds successfully."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome" in response.json()["message"]
