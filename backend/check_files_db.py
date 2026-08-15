import asyncio
from app.core.database import SessionLocal
from app.models.files import UploadedFile
from app.models.users import User
from sqlalchemy.future import select

async def check_files():
    async with SessionLocal() as db:
        result = await db.execute(select(UploadedFile))
        files = result.scalars().all()
        print("\n=== UPLOADED FILES IN DATABASE ===")
        for f in files:
            print(f"ID: {f.id} | Filename: {f.filename} | Version: {f.version}")
            print(f"  Status: {f.status} | Workflow: {f.workflow_status}")
            print(f"  Lineage Info: {f.lineage_info}")
            print("-"*50)

if __name__ == "__main__":
    asyncio.run(check_files())
