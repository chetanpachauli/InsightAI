# 🚀 Render Backend Deployment Guide

## **🔗 Frontend URL (Already Live)**
```
✅ https://frontend-nine-woad-19.vercel.app
✅ Voice Assistant: /voice
✅ Dashboard: /dashboard
✅ Rules: /rules
```

## **⚙️ Backend Configuration for Render**

### **1. Database (PostgreSQL on Render)**

**Option A: Use Render PostgreSQL (Recommended)**
1. Go to Render Dashboard → PostgreSQL
2. Create new PostgreSQL database
3. Copy connection string

**Option B: Neon.tech (Free PostgreSQL)**
1. Signup at https://neon.tech
2. Create project → Get connection string

### **2. Environment Variables**

**MUST SET these in Render Dashboard:**

```
DATABASE_URL = [Your PostgreSQL connection string]
JWT_SECRET_KEY = [Generate strong random string]
CORS_ORIGINS = https://frontend-nine-woad-19.vercel.app
ENVIRONMENT = production

# Optional (if using features):
GEMINI_API_KEY = [Your Google AI Studio key]
SMTP_USER = [Your email]
SMTP_PASSWORD = [App password]
TWILIO_ACCOUNT_SID = [Twilio SID]
TWILIO_AUTH_TOKEN = [Twilio token]
```

### **3. Steps to Deploy**

**Step 1: Login to Render**
```
URL: https://render.com
Login: GitHub account
```

**Step 2: Create Web Service**
```
Click: "New +" → "Web Service"
Connect: GitHub repository (chetanpachauli/InsightAI)
```

**Step 3: Configure Service**
```
Name: insightai-backend
Region: Oregon (us-west) [or nearest to you]
Branch: main
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: python run.py
Instance Type: Free
```

**Step 4: Set Environment Variables**
```
Add all variables from section 2 above
```

**Step 5: Deploy**
```
Click: "Create Web Service"
Wait: 5-10 minutes for first deploy
```

### **4. Expected Output**

**When Successful:**
```
✅ Build logs: Python packages installing
✅ Deployment: Application starting
✅ URL: https://insightai-backend.onrender.com
✅ API Docs: https://insightai-backend.onrender.com/docs
```

### **5. Testing Backend**

**Check API:**
```bash
# Health check
curl https://insightai-backend.onrender.com/api/health

# API docs
open https://insightai-backend.onrender.com/docs
```

### **6. Update Frontend API URL**

**File to modify:**
```
frontend/.env.local (or environment variables in Vercel)
```

**Set:**
```
NEXT_PUBLIC_API_URL=https://insightai-backend.onrender.com/api
```

**OR redeploy frontend with updated env:**

### **7. Full Stack Testing**

**Voice Assistant:**
```
1. Open: https://frontend-nine-woad-19.vercel.app/voice
2. Test voice commands
3. Test quick buttons
4. Test text input
```

**Rules Engine:**
```
1. Open: https://frontend-nine-woad-19.vercel.app/rules
2. Create test rule
3. Click "Test All Rules Now"
4. Check audit logs
```

### **8. Troubleshooting**

**Common Issues:**

1. **Database connection error**
   - Check DATABASE_URL format
   - Ensure PostgreSQL is running
   - Test connection via psql

2. **CORS error**
   - Verify CORS_ORIGINS includes frontend URL
   - Check for typos in URL

3. **Build fails**
   - Check requirements.txt
   - Ensure Python 3.11+ support
   - Check render.yaml syntax

4. **App crashes**
   - Check logs in Render dashboard
   - Verify environment variables
   - Test locally with same config

### **9. Production Checklist**

- [ ] Database backup enabled
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] JWT secret is strong
- [ ] API rate limiting considered
- [ ] Error logging setup
- [ ] Monitoring alerts configured

### **10. Success Indicators**

**✅ Backend Running:**
```
Status: Live
Health: /api/health returns 200
Docs: /docs accessible
CORS: Frontend can connect
Database: Connected and responding
```

**✅ Frontend Connected:**
```
API calls succeed
Voice assistant works with backend
Rules engine triggers notifications
File uploads work
```

## **🌐 Final Architecture**

```
Frontend: https://frontend-nine-woad-19.vercel.app
Backend: https://insightai-backend.onrender.com
Database: Render PostgreSQL / Neon
Voice Assistant: Client-side (no backend needed for voice)
```

## **📞 Support**

**If deployment fails:**
1. Check Render logs
2. Verify GitHub repo connection
3. Test locally with same config
4. Check Python version compatibility

**Expected Timeline:**
```
✅ Frontend: Already live
🔄 Backend: 10-15 minutes setup
✅ Voice Assistant: Live and working
✅ Rules Engine: Ready for testing
```

## **🎉 Deployment Complete When:**

1. ✅ Backend URL accessible
2. ✅ API documentation working
3. ✅ Database connected
4. ✅ Frontend can call backend
5. ✅ Voice assistant fully functional
6. ✅ All features tested

**Let's deploy! 🚀**
