#!/usr/bin/env python3
"""
Production setup script for InsightAI Backend on Render.
This script helps validate production configuration.
"""

import os
import sys
import secrets
from pathlib import Path

def generate_secret_key():
    """Generate a strong random secret key for JWT"""
    return secrets.token_urlsafe(32)

def check_requirements():
    """Check if all requirements are met for production"""
    print("🔍 Checking production requirements...")
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or python_version.minor < 11:
        print(f"❌ Python 3.11+ required, found {python_version.major}.{python_version.minor}")
        return False
    
    print(f"✅ Python {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    # Check requirements.txt exists
    req_file = Path("requirements.txt")
    if not req_file.exists():
        print("❌ requirements.txt not found")
        return False
    
    print("✅ requirements.txt found")
    
    # Check render.yaml exists
    render_file = Path("render.yaml")
    if not render_file.exists():
        print("⚠️  render.yaml not found (optional but recommended)")
    
    return True

def setup_environment():
    """Create production environment template"""
    print("\n📝 Creating production environment template...")
    
    env_template = """# ============================================
# InsightAI Production Environment
# ============================================

# Database (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:password@host:port/database

# Security
JWT_SECRET_KEY={jwt_secret}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (Frontend URLs)
CORS_ORIGINS=https://frontend-nine-woad-19.vercel.app

# Production settings
ENVIRONMENT=production
DB_ECHO=false
AUTO_CREATE_TABLES=false

# Optional Features (uncomment and set if needed)
# GEMINI_API_KEY=your_gemini_api_key
# SMTP_USER=your_email@gmail.com
# SMTP_PASSWORD=your_app_password
# TWILIO_ACCOUNT_SID=your_twilio_account_sid
# TWILIO_AUTH_TOKEN=your_twilio_auth_token
"""
    
    jwt_secret = generate_secret_key()
    env_content = env_template.format(jwt_secret=jwt_secret)
    
    with open(".env.production.example", "w") as f:
        f.write(env_content)
    
    print("✅ Created .env.production.example")
    print(f"✅ Generated JWT secret: {jwt_secret[:20]}...")
    
    return True

def check_app_structure():
    """Check application structure"""
    print("\n🏗️  Checking application structure...")
    
    required_files = [
        "app/main.py",
        "app/core/config.py",
        "requirements.txt",
        "run.py"
    ]
    
    all_good = True
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} not found")
            all_good = False
    
    return all_good

def main():
    """Main setup function"""
    print("🚀 InsightAI Backend Production Setup")
    print("=" * 50)
    
    # Change to backend directory
    original_dir = os.getcwd()
    try:
        os.chdir(Path(__file__).parent)
    except:
        pass
    
    # Run checks
    if not check_requirements():
        print("\n❌ Requirements check failed. Please fix issues before deployment.")
        sys.exit(1)
    
    if not check_app_structure():
        print("\n⚠️  App structure issues found. Some features may not work.")
    
    # Setup environment
    setup_environment()
    
    # Print deployment instructions
    print("\n" + "=" * 50)
    print("📋 DEPLOYMENT INSTRUCTIONS")
    print("=" * 50)
    print("\n1. 🚀 Deploy to Render:")
    print("   - Go to https://render.com")
    print("   - Click 'New +' → 'Web Service'")
    print("   - Connect GitHub repository")
    print("   - Use these settings:")
    print("     • Name: insightai-backend")
    print("     • Region: Oregon (us-west)")
    print("     • Branch: main")
    print("     • Root Directory: backend")
    print("     • Build Command: pip install -r requirements.txt")
    print("     • Start Command: python run.py")
    print("     • Instance: Free")
    print("\n2. 🔑 Set Environment Variables in Render Dashboard:")
    print("   • DATABASE_URL: Your PostgreSQL connection string")
    print("   • JWT_SECRET_KEY: Use the generated secret")
    print("   • CORS_ORIGINS: https://frontend-nine-woad-19.vercel.app")
    print("   • ENVIRONMENT: production")
    print("\n3. 🗄️  Setup Database:")
    print("   • Option A: Create PostgreSQL on Render")
    print("   • Option B: Use Neon.tech (free tier)")
    print("\n4. ✅ Test Deployment:")
    print("   • Check health: https://[your-backend].onrender.com/health")
    print("   • Check docs: https://[your-backend].onrender.com/docs")
    print("\n5. 🔗 Connect Frontend:")
    print("   • Frontend is already live: https://frontend-nine-woad-19.vercel.app")
    print("   • Update API URL in frontend if needed")
    
    print("\n🎉 Setup complete! Ready for deployment.")
    print("💡 Check .env.production.example for environment variables.")

if __name__ == "__main__":
    main()