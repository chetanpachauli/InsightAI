# 🔐 InsightAI - Database Access Guide

## 📊 **Database Information**

### **Local Development (Docker):**
```
Type: PostgreSQL 15
Host: localhost (db inside Docker)
Port: 5432
Database: insightai
Username: postgres
Password: postgres
```

### **Production (Render):**
```
Type: PostgreSQL (Render managed)
Connection: Set in Render dashboard environment variables
Database: Auto-created by Render
```

---

## 👥 **Admin Users Created**

### **Local Development Database:**

#### **Admin User #1:**
```
Email: admin@insightai.com
Password: Admin@123
Role: Admin
Status: Active ✅
Created: Today
```

#### **Admin User #2 (Existing):**
```
Email: chetanpachauli9@gmail.com
Password: [Your password]
Role: Admin
Status: Active ✅
Created: Aug 12, 2026
```

#### **CEO User:**
```
Email: ceo@insightai.com
Password: Ceo@12345
Role: CEO
Status: Active ✅
Created: Today
```

#### **Test Users:**
```
1. Email: chetanpachauli@gmail.com
   Role: Employee
   
2. Email: testuser@example.com
   Role: MIS
```

---

## 🔑 **Login URLs**

### **Local Development:**
```
Frontend: http://localhost:3000/login
Backend API: http://localhost:8000/api/v1/auth/login

Login with:
Email: admin@insightai.com
Password: Admin@123
```

### **Production:**
```
Frontend: https://chetan-insightai.vercel.app/login
Backend API: https://insightai-backend-367c.onrender.com/api/v1/auth/login

Login with:
Email: admin@insightai.com
Password: Admin@123
```

---

## 🛠️ **Database Management**

### **Connect to Local PostgreSQL:**

#### **Using Docker:**
```bash
# Connect to database container
docker exec -it insightai_db psql -U postgres -d insightai

# View all users
docker exec -it insightai_db psql -U postgres -d insightai -c "SELECT id, email, role, is_active FROM users;"

# View all tables
docker exec -it insightai_db psql -U postgres -d insightai -c "\dt"
```

#### **Using pgAdmin / DBeaver:**
```
Host: localhost
Port: 5432
Database: insightai
Username: postgres
Password: postgres
```

### **Create New Admin User:**

#### **Using Docker (Recommended):**
```bash
# Syntax:
docker exec -it insightai_backend python seed_admin.py <email> <password> <role>

# Examples:
docker exec -it insightai_backend python seed_admin.py manager@insightai.com Manager@123 Manager

docker exec -it insightai_backend python seed_admin.py mis@insightai.com Mis@12345 MIS
```

#### **Using Python Script (if backend is running locally):**
```bash
cd backend
python seed_admin.py admin2@example.com SecurePass@123 Admin
```

---

## 📋 **User Roles & Permissions**

### **Role Hierarchy:**
```
1. CEO         - Full access to everything
2. Admin       - Full access to everything
3. Manager     - Can review files, create rules, view reports
4. MIS         - Can upload files, create rules, manage data
5. Employee    - Basic access, view dashboards
```

### **Permission Matrix:**

| Feature | Employee | MIS | Manager | Admin | CEO |
|---------|----------|-----|---------|-------|-----|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload Files | ❌ | ✅ | ❌ | ✅ | ✅ |
| Approve Files | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create Rules | ❌ | ✅ | ✅ | ✅ | ✅ |
| Delete Files | ❌ | ✅ | ❌ | ✅ | ✅ |
| Send Notifications | ❌ | ✅ | ✅ | ✅ | ✅ |
| View Audit Logs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voice Assistant | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🔍 **Database Queries**

### **View All Users:**
```sql
SELECT id, email, role, is_active, created_at 
FROM users 
ORDER BY created_at DESC;
```

### **View Admin Users:**
```sql
SELECT id, email, role, created_at 
FROM users 
WHERE role IN ('Admin', 'CEO') 
ORDER BY created_at DESC;
```

### **View All Files:**
```sql
SELECT id, filename, version, workflow_status, uploaded_at 
FROM uploaded_files 
ORDER BY uploaded_at DESC 
LIMIT 10;
```

### **View All Rules:**
```sql
SELECT id, rule_name, metric, condition, threshold, is_active 
FROM alert_rules 
ORDER BY created_at DESC;
```

### **View Audit Logs:**
```sql
SELECT id, action, user_email, details, timestamp 
FROM audit_logs 
ORDER BY timestamp DESC 
LIMIT 20;
```

---

## 🔒 **Security Notes**

### **Password Requirements:**
```
✅ Minimum 8 characters
✅ At least 1 uppercase letter
✅ At least 1 lowercase letter
✅ At least 1 number
✅ At least 1 special character (@, #, $, etc.)

Examples:
- Admin@123 ✅
- Secure@Pass2024 ✅
- MyP@ssw0rd ✅
- password ❌ (too weak)
```

### **Important:**
```
⚠️ Never commit .env with real passwords to GitHub
⚠️ Use different passwords for production
⚠️ Enable 2FA for production databases
⚠️ Regularly backup production database
⚠️ Keep seed_admin.py script secure
```

---

## 🧪 **Testing Admin Access**

### **1. Test Login (Local):**
```bash
# Using curl
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@insightai.com&password=Admin@123"

# Expected: JSON with access_token
```

### **2. Test Login (Production):**
```bash
# Using curl
curl -X POST https://insightai-backend-367c.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@insightai.com&password=Admin@123"

# Expected: JSON with access_token
```

### **3. Test Admin Features:**
```
1. Login to frontend: http://localhost:3000/login
2. Use: admin@insightai.com / Admin@123
3. Try these features:
   ✅ Upload file (only Admin/MIS can)
   ✅ Approve file (only Admin/Manager/CEO can)
   ✅ Delete file (only Admin/MIS can)
   ✅ Create rule (only Admin/Manager/MIS can)
   ✅ View all pages
```

---

## 📊 **Database Schema**

### **Main Tables:**
```
users               - User accounts and authentication
uploaded_files      - File upload metadata
alert_rules         - Automation rules
audit_logs          - Activity logging
documents           - Document management
notifications       - Notification tracking

Dynamic tables created per uploaded file:
- file_<id>_<filename> - Data from uploaded CSV/Excel
```

---

## 🚀 **Quick Commands**

### **Start Database:**
```bash
docker-compose up -d db
```

### **Stop Database:**
```bash
docker-compose stop db
```

### **Backup Database:**
```bash
docker exec -it insightai_db pg_dump -U postgres insightai > backup_$(date +%Y%m%d).sql
```

### **Restore Database:**
```bash
cat backup_20260902.sql | docker exec -i insightai_db psql -U postgres insightai
```

### **View Database Logs:**
```bash
docker logs insightai_db
```

---

## 🎯 **Summary**

**✅ Admin users created and working**
**✅ Local database accessible**
**✅ Role-based permissions configured**
**✅ Security measures in place**

**Login and test:**
```
URL: http://localhost:3000/login
Email: admin@insightai.com
Password: Admin@123
Role: Admin (full access)
```

**Production Ready:**
```
URL: https://chetan-insightai.vercel.app/login
Same credentials work in production too!
```

---

**Last Updated:** January 15, 2026  
**Database Status:** ✅ Running  
**Admin Access:** ✅ Configured
