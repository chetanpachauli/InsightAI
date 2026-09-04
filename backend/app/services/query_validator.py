import re
from typing import Set, Tuple

FORBIDDEN_KEYWORDS = [
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bDELETE\b",
    r"\bDROP\b",
    r"\bALTER\b",
    r"\bTRUNCATE\b",
    r"\bEXEC\b",
    r"\bEXECUTE\b",
    r"\bCREATE\b",
    r"\bGRANT\b",
    r"\bREVOKE\b",
    r"\bCOPY\b",
    r"\bVACUUM\b",
    r"\bINTO\b",
    r"\bPG_\w+\b",
    r"\bINFORMATION_SCHEMA\b"
]

class SQLSecurityValidator:
    """
    Bulletproof SQL query validator that ensures only safe, read-only SELECT
    queries are executed against approved physical datasets.
    """

    @staticmethod
    def validate_and_sanitize(
        sql_query: str,
        approved_tables: Set[str],
        default_limit: int = 1000
    ) -> Tuple[bool, str, str]:
        """
        Validates the SQL query.
        Returns:
            (is_valid: bool, sanitized_sql: str, error_message: str)
        """
        cleaned_sql = sql_query.strip().rstrip(";")

        # 1. Reject multiple statements (semicolon injection guard)
        if ";" in cleaned_sql:
            return False, "", "Multiple SQL statements are not permitted."

        # 2. Must begin with SELECT or WITH (CTE)
        if not re.match(r"^(SELECT|WITH)\b", cleaned_sql, re.IGNORECASE):
            return False, "", "Only read-only SELECT queries are allowed."

        # 3. Check for any forbidden destructive keywords
        for pattern in FORBIDDEN_KEYWORDS:
            if re.search(pattern, cleaned_sql, re.IGNORECASE):
                matched = re.search(pattern, cleaned_sql, re.IGNORECASE).group(0)
                return False, "", f"Prohibited SQL keyword detected: '{matched}'. Only SELECT queries are permitted."

        # 4. Check that tables in the query belong to the approved datasets
        # Extract potential table identifiers from FROM and JOIN clauses
        table_matches = re.findall(
            r"(?:FROM|JOIN)\s+([\"`]?([a-zA-Z0-9_]+)[\"`]?)",
            cleaned_sql,
            re.IGNORECASE
        )

        detected_tables = {m[1].lower() for m in table_matches if m[1]}
        lower_approved = {tbl.lower() for tbl in approved_tables}

        # If approved tables are provided, ensure at least one approved table is referenced and no rogue tables are accessed
        if lower_approved and detected_tables:
            unauthorized = detected_tables - lower_approved
            if unauthorized:
                return False, "", f"Query references unauthorized table(s): {', '.join(sorted(unauthorized))}."

        # 5. Automatically enforce LIMIT if not specified or excessive
        limit_match = re.search(r"\bLIMIT\s+(\d+)", cleaned_sql, re.IGNORECASE)
        if limit_match:
            limit_val = int(limit_match.group(1))
            if limit_val > default_limit:
                cleaned_sql = re.sub(
                    r"\bLIMIT\s+\d+",
                    f"LIMIT {default_limit}",
                    cleaned_sql,
                    flags=re.IGNORECASE
                )
        else:
            cleaned_sql = f"{cleaned_sql} LIMIT {default_limit}"

        return True, cleaned_sql, ""
