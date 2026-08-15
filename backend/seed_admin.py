"""
Create or elevate a user to a privileged role (Admin / CEO).

Usage (run from the backend/ folder):
    python seed_admin.py <email> <password> [role]

    role is one of: Admin, CEO, Manager, MIS, Employee  (default: Admin)

Because self-registration is restricted to safe roles, privileged accounts
must be created with this script (or directly in the database).
"""
import asyncio
import os
import sys
from dotenv import load_dotenv
from sqlalchemy.future import select

# Make `app` importable from the backend folder
backend_path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_path)
load_dotenv(os.path.join(os.path.dirname(backend_path), ".env"))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.users import User

ALLOWED_ROLES = {"Admin", "CEO", "Manager", "MIS", "Employee"}


async def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    password = sys.argv[2]
    role = sys.argv[3] if len(sys.argv) > 3 else "Admin"

    if role not in ALLOWED_ROLES:
        print(f"Invalid role '{role}'. Allowed: {', '.join(sorted(ALLOWED_ROLES))}")
        sys.exit(1)

    if len(password) < 8:
        print("Password must be at least 8 characters long.")
        sys.exit(1)

    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if user:
            user.role = role
            user.is_active = True
            user.hashed_password = hash_password(password)
            action = "updated"
        else:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                role=role,
                is_active=True,
            )
            session.add(user)
            action = "created"

        await session.commit()
        print(f"✅ User '{email}' {action} with role '{role}'.")


if __name__ == "__main__":
    asyncio.run(main())
