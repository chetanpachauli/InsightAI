import polars as pl
import os
import re
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.files import UploadedFile
from app.models.audit_logs import AuditLog
from datetime import datetime

class ETLService:
    @staticmethod
    def clean_header(header: str) -> str:
        """Sanitize a column header to make it a valid PostgreSQL identifier."""
        # Convert to lower case, replace spaces/special chars with underscores, strip extra underscores
        h = header.strip().lower()
        h = re.sub(r'[^a-z0-9_]', '_', h)
        h = re.sub(r'_+', '_', h)
        h = h.strip('_')
        # SQL identifiers cannot start with numbers, prefix with 'col_' if it does
        if h and h[0].isdigit():
            h = f"col_{h}"
        return h or "unnamed_column"

    @staticmethod
    def map_polars_to_postgres(dtype) -> str:
        """Map Polars datatypes to PostgreSQL database types."""
        dt_str = str(dtype)
        if "Int" in dt_str:
            return "INTEGER"
        elif "Float" in dt_str or "Decimal" in dt_str:
            return "DOUBLE PRECISION"
        elif "Boolean" in dt_str:
            return "BOOLEAN"
        elif "Date" in dt_str or "Datetime" in dt_str:
            return "TIMESTAMP"
        else:
            return "TEXT"

    async def process_file_etl(self, file_id: int, db: AsyncSession) -> dict:
        """
        ETL Pipeline:
        1. Read CSV/Excel using Polars.
        2. Detect duplicates, empty fields, and analyze shape.
        3. Clean and sanitize column headers.
        4. Dynamically create a PostgreSQL table `data_file_{file_id}_v{version}`.
        5. Bulk insert the cleaned records.
        6. Log lineage information.
        """
        # Fetch file record from DB
        try:
            file_record = await db.get(UploadedFile, file_id)
            if not file_record:
                raise ValueError(f"File ID {file_id} not found in database.")
        except Exception as e:
            print(f"Error fetching file record: {str(e)}")
            raise

        file_path = file_record.file_path
        if not os.path.exists(file_path):
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = f"Physical file not found at {file_path}"
            file_record.lineage_info = lineage
            await db.commit()
            raise FileNotFoundError(f"Physical file not found at {file_path}")

        # 1. Read file into Polars DataFrame
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        if ext not in [".csv", ".xlsx", ".xls"]:
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = f"Unsupported file extension: {ext}"
            file_record.lineage_info = lineage
            await db.commit()
            raise ValueError(f"Unsupported file extension: {ext}")
        
        try:
            if ext == ".csv":
                df = pl.read_csv(file_path)
            elif ext in [".xlsx", ".xls"]:
                # Openpyxl is used under the hood for xlsx in Polars
                df = pl.read_excel(file_path)
            else:
                raise ValueError("Unsupported extension")
        except Exception as e:
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = f"Error reading file with Polars: {str(e)}"
            file_record.lineage_info = lineage
            await db.commit()
            raise RuntimeError(f"Error reading file with Polars: {str(e)}")
        
        # Validate DataFrame is not empty
        if df.height == 0:
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = "File contains no data rows"
            file_record.lineage_info = lineage
            await db.commit()
            raise ValueError("File contains no data rows")
        
        if df.width == 0:
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = "File contains no columns"
            file_record.lineage_info = lineage
            await db.commit()
            raise ValueError("File contains no columns")

        # 2. Extract metrics for Data Lineage & Cleaning
        total_rows = df.height
        total_cols = df.width
        
        # Calculate duplicates (rows that have same values across all columns)
        duplicate_count = total_rows - df.unique().height
        
        # Calculate null/empty counts
        null_count = sum(df[col].null_count() for col in df.columns)

        # 3. Clean Headers & Map Columns
        original_headers = df.columns
        if not original_headers:
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = "No column headers found in file"
            file_record.lineage_info = lineage
            await db.commit()
            raise ValueError("No column headers found in file")
        
        clean_headers = [self.clean_header(h) for h in original_headers]
        
        # Check for duplicate column names after cleaning
        if len(clean_headers) != len(set(clean_headers)):
            # Handle duplicates by appending index
            seen = {}
            for i, header in enumerate(clean_headers):
                if header in seen:
                    seen[header] += 1
                    clean_headers[i] = f"{header}_{seen[header]}"
                else:
                    seen[header] = 0
        
        # Rename Polars columns to clean SQL headers
        try:
            rename_dict = dict(zip(original_headers, clean_headers))
            df = df.rename(rename_dict)
        except Exception as e:
            file_record.status = "FAILED"
            lineage = file_record.lineage_info or {}
            lineage["processing_error"] = f"Error renaming columns: {str(e)}"
            file_record.lineage_info = lineage
            await db.commit()
            raise RuntimeError(f"Error renaming columns: {str(e)}")

        # Map each column to PostgreSQL datatype
        col_definitions = []
        for col_name in clean_headers:
            try:
                pg_type = self.map_polars_to_postgres(df[col_name].dtype)
                col_definitions.append(f'"{col_name}" {pg_type}')
            except Exception as e:
                print(f"Warning: Error mapping column '{col_name}': {str(e)}")
                # Default to TEXT for problematic columns
                col_definitions.append(f'"{col_name}" TEXT')

        # 4. Generate dynamic table name
        # Format: data_file_{file_id}_v{version}
        clean_filename_slug = re.sub(r'[^a-z0-9]', '_', file_record.filename.lower().split('.')[0])
        # Sanitize to prevent SQL injection - only allow alphanumeric and underscore
        clean_filename_slug = re.sub(r'[^a-z0-9_]', '', clean_filename_slug)
        # Limit length to prevent excessively long table names
        clean_filename_slug = clean_filename_slug[:50]
        dynamic_table_name = f"data_{clean_filename_slug}_v{file_record.version}"
        
        # Additional validation: ensure table name doesn't contain SQL keywords
        sql_keywords = ['select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate']
        if any(keyword in dynamic_table_name.lower() for keyword in sql_keywords):
            raise ValueError(f"Table name contains SQL keyword: {dynamic_table_name}")

        # Execute table dropping first
        drop_table_sql = f"DROP TABLE IF EXISTS {dynamic_table_name};"
        
        # Then execute table creation
        create_table_sql = f"""
        CREATE TABLE {dynamic_table_name} (
            _row_id SERIAL PRIMARY KEY,
            _source_file_id INTEGER DEFAULT {file_id},
            {", ".join(col_definitions)}
        );
        """

        try:
            # Execute both statements sequentially
            await db.execute(text(drop_table_sql))
            await db.execute(text(create_table_sql))
            
            # 5. Bulk Insert Data
            # Construct parameterized insert query
            columns_str = ", ".join([f'"{c}"' for c in clean_headers])
            placeholders_str = ", ".join([f":{c}" for c in clean_headers])
            insert_sql = f"INSERT INTO {dynamic_table_name} ({columns_str}) VALUES ({placeholders_str})"
            
            # Convert Polars DataFrame to a list of dicts for batch execution
            try:
                records = df.to_dicts()
            except Exception as e:
                raise RuntimeError(f"Error converting DataFrame to dict records: {str(e)}")
            
            # Execute batch inserts with error handling
            if records:
                try:
                    # SQLAlchemy execute with list of params binds automatically
                    await db.execute(text(insert_sql), records)
                except Exception as insert_err:
                    print(f"Error during batch insert: {str(insert_err)}")
                    # Try inserting records one by one to identify problematic rows
                    successful_inserts = 0
                    failed_rows = []
                    for idx, record in enumerate(records):
                        try:
                            await db.execute(text(insert_sql), record)
                            successful_inserts += 1
                        except Exception as row_err:
                            failed_rows.append({"row_index": idx, "error": str(row_err)})
                            if len(failed_rows) < 5:  # Log first 5 failures
                                print(f"Failed to insert row {idx}: {str(row_err)}")
                    
                    if successful_inserts == 0:
                        raise RuntimeError(f"Failed to insert any records. Total failures: {len(failed_rows)}")
                    else:
                        print(f"Partial success: {successful_inserts}/{len(records)} rows inserted. {len(failed_rows)} failures.")

            # 6. Update File status & Lineage
            file_record.status = "COMPLETED"
            
            lineage = file_record.lineage_info or {}
            lineage.update({
                "processed_at": datetime.utcnow().isoformat(),
                "db_table": dynamic_table_name,
                "metrics": {
                    "total_rows": total_rows,
                    "total_columns": total_cols,
                    "duplicate_rows_detected": duplicate_count,
                    "missing_cells_detected": null_count
                },
                "columns_mapped": [
                    {"original": orig, "cleaned": clean, "type": self.map_polars_to_postgres(df[clean].dtype)}
                    for orig, clean in zip(original_headers, clean_headers)
                ]
            })
            file_record.lineage_info = lineage
            
            # Audit log
            audit = AuditLog(
                user_id=file_record.owner_id,
                action="FILE_CLEANED",
                details=f"ETL completed for File ID {file_id}. Loaded {total_rows} rows into table {dynamic_table_name}.",
                lineage_step="AI_CLEANED"
            )
            db.add(audit)
            
            await db.commit()
            
            # Trigger custom alert rule engine checks on the new table
            try:
                await self.check_rules_on_table(dynamic_table_name, db)
            except Exception as rule_err:
                print(f"Rules evaluation failed: {str(rule_err)}")
            
            return {
                "status": "SUCCESS",
                "table_name": dynamic_table_name,
                "rows_inserted": total_rows,
                "duplicates": duplicate_count,
                "nulls": null_count
            }

        except Exception as e:
            # Rollback and print original traceback first
            import traceback
            print("--- ETL PROCESS INITIAL EXCEPTION TRACEBACK ---")
            traceback.print_exc()
            print("-----------------------------------------------")
            
            await db.rollback()
            
            # Use db.get again to prevent greenlet expiration issues after rollback
            refreshed_record = await db.get(UploadedFile, file_id)
            if refreshed_record:
                refreshed_record.status = "FAILED"
                lineage = refreshed_record.lineage_info or {}
                lineage["processing_error"] = str(e)
                refreshed_record.lineage_info = lineage
                
                audit = AuditLog(
                    user_id=refreshed_record.owner_id,
                    action="FILE_CLEAN_FAIL",
                    details=f"ETL failed for File ID {file_id}. Error: {str(e)}",
                    lineage_step="FAILED"
                )
                db.add(audit)
                await db.commit()
            raise e

    async def check_rules_on_table(self, table_name: str, db: AsyncSession):
        """Query active rules, check conditions on the table, and trigger alerts/webhooks."""
        from app.models.rules import AlertRule
        from app.models.audit_logs import AuditLog
        from sqlalchemy.future import select
        from sqlalchemy import text
        import httpx
        
        # SQL injection protection: validate table name format
        if not re.match(r'^[a-zA-Z0-9_]+$', table_name):
            print(f"Invalid table name format for rules check: {table_name}")
            return
        
        try:
            # 1. Fetch all active rules
            result = await db.execute(select(AlertRule).where(AlertRule.is_active == True))
            active_rules = result.scalars().all()
            
            for rule in active_rules:
                # Security Operator Check to prevent SQL injection
                allowed_operators = ["<", ">", "==", "!=", "<=", ">="]
                if rule.operator not in allowed_operators:
                    continue
                sql_op = "=" if rule.operator == "==" else rule.operator
                
                # Dynamic SQL check query
                check_sql = f'SELECT COUNT(*) FROM {table_name} WHERE "{rule.condition_col}" {sql_op} :val'
                
                try:
                    res = await db.execute(text(check_sql), {"val": rule.value})
                    count = res.scalar() or 0
                except Exception:
                    # Column doesn't exist in this file, skip this rule
                    continue
                
                if count > 0:
                    # Rule Triggered!
                    details_str = f"Rule '{rule.name}' triggered on table '{table_name}'. Found {count} matching records (Condition: {rule.condition_col} {rule.operator} {rule.value})."
                    
                    # Log in Audit Logs (displayed in Live Feed on Dashboard)
                    trigger_audit = AuditLog(
                        user_id=rule.owner_id,
                        action="RULE_TRIGGERED",
                        details=details_str,
                        lineage_step="RULE_ALERT"
                    )
                    db.add(trigger_audit)
                    await db.commit()
                    
                    # If webhook is configured
                    if rule.action_type == "WEBHOOK" and rule.webhook_url:
                        # Construct a rich Slack/Discord Block Kit message payload
                        payload = {
                            "text": f"🚨 *InsightAI Alert: Rule Triggered!*",
                            "attachments": [
                                {
                                    "color": "#ef4444", # Red theme
                                    "title": f"Trigger Rule: {rule.name}",
                                    "text": details_str,
                                    "fields": [
                                        {"title": "Table Source", "value": table_name, "short": True},
                                        {"title": "Matching Rows", "value": str(count), "short": True}
                                    ],
                                    "footer": "InsightAI Platform Automated Engine"
                                }
                            ]
                        }
                        
                        try:
                            # Send webhook notification asynchronously
                            async with httpx.AsyncClient() as client:
                                await client.post(rule.webhook_url, json=payload, timeout=5.0)
                        except Exception as webhook_err:
                            print(f"Failed to deliver webhook alert: {str(webhook_err)}")
                            
                    elif rule.action_type == "EMAIL" and rule.recipient:
                        from app.services.notification_service import notification_service
                        subject = f"🚨 InsightAI Alert: Rule '{rule.name}' Triggered"
                        condition_label = f"IF {rule.condition_col} {rule.operator} {rule.value}"
                        notification_service.send_email_notification(
                            recipient=rule.recipient,
                            subject=subject,
                            rule_name=rule.name,
                            table_name=table_name,
                            condition=condition_label,
                            count=count
                        )
                        
                    elif rule.action_type == "WHATSAPP" and rule.recipient:
                        from app.services.notification_service import notification_service
                        whatsapp_body = (
                            f"🚨 *InsightAI Enterprise Alert!* 🚨\n\n"
                            f"*Rule Name:* {rule.name}\n"
                            f"*Source Sheet:* {table_name}\n"
                            f"*Condition:* IF {rule.condition_col} {rule.operator} {rule.value}\n"
                            f"*Matching Anomalies:* {count} records matched!\n\n"
                            f"ℹ️ *Action Required:* Please login to your InsightAI Dashboard to take immediate action."
                        )
                        notification_service.send_whatsapp_notification(
                            recipient=rule.recipient,
                            message=whatsapp_body
                        )
                        
        except Exception as e:
            print(f"Error executing rules validation: {str(e)}")

# Instantiate singleton
etl_service = ETLService()
