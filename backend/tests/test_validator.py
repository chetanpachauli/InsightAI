import pytest
from app.services.query_validator import SQLSecurityValidator

class TestSQLSecurityValidator:
    approved_tables = {"sales_data_v1", "customer_records_v1"}

    def test_valid_select_query(self):
        query = "SELECT region, SUM(amount) AS total FROM sales_data_v1 GROUP BY region"
        is_valid, sanitized, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is True
        assert "LIMIT 1000" in sanitized
        assert err == ""

    def test_blocks_drop_statement(self):
        query = "DROP TABLE sales_data_v1"
        is_valid, _, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is False
        assert "Only read-only SELECT queries are allowed" in err or "Prohibited SQL keyword" in err

    def test_blocks_delete_statement(self):
        query = "DELETE FROM sales_data_v1 WHERE amount < 0"
        is_valid, _, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is False
        assert "Only read-only SELECT queries are allowed" in err or "Prohibited SQL keyword" in err

    def test_blocks_update_statement(self):
        query = "UPDATE sales_data_v1 SET amount = 999"
        is_valid, _, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is False

    def test_blocks_multiple_statements_semicolon(self):
        query = "SELECT * FROM sales_data_v1; DROP TABLE customer_records_v1"
        is_valid, _, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is False
        assert "Multiple SQL statements are not permitted" in err

    def test_blocks_system_catalogs(self):
        query = "SELECT * FROM pg_database"
        is_valid, _, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is False
        assert "Prohibited SQL keyword detected" in err or "unauthorized table" in err

    def test_blocks_unauthorized_tables(self):
        query = "SELECT * FROM users_private_credentials"
        is_valid, _, err = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables)
        assert is_valid is False
        assert "unauthorized table" in err

    def test_clamps_excessive_limit(self):
        query = "SELECT * FROM sales_data_v1 LIMIT 999999"
        is_valid, sanitized, _ = SQLSecurityValidator.validate_and_sanitize(query, self.approved_tables, default_limit=1000)
        assert is_valid is True
        assert "LIMIT 1000" in sanitized
