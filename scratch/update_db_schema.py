import asyncio
from sqlalchemy import text
from app.core.database import SessionLocal
async def alter_database_schema():
    async with SessionLocal() as db:
        try:
            print("Altering 'alert_rules' table to add missing 'webhook_url' column...")
            await db.execute(text("ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(255);"))
            await db.commit()
            print("Successfully updated database schema!")
        except Exception as e:
            print(f"Error altering schema: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(alter_database_schema())
