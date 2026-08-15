import asyncio
from app.core.database import SessionLocal
from app.models.rules import AlertRule
from app.models.users import User
from app.models.files import UploadedFile
from sqlalchemy.future import select

async def check_rules():
    async with SessionLocal() as db:
        result = await db.execute(select(AlertRule))
        rules = result.scalars().all()
        print("\n=== REGISTERED RULES IN DATABASE ===")
        for r in rules:
            print(f"Name: {r.name}")
            print(f"  Condition: {r.condition_col} {r.operator} {r.value}")
            print(f"  Action: {r.action_type}")
            print(f"  Recipient: {r.recipient}")
            print(f"  Is Active: {r.is_active}")
            print(f"  Webhook URL: {r.webhook_url}")
            print("-"*35)

if __name__ == "__main__":
    asyncio.run(check_rules())
