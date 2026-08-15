# Rules Engine Testing Guide - InsightAI

## 🔍 समस्या की पहचान (Problem Identified)

Rules page से notifications इसलिए नहीं जा रहे थे क्योंकि:

1. ❌ **Rules केवल file upload के समय trigger होते थे**
2. ❌ **Manual testing का कोई option नहीं था**
3. ❌ **Real-time rule checking नहीं था**

## ✅ समाधान (Solution Implemented)

अब हमने **"Test All Rules Now"** button add किया है जो:
- ✅ सभी approved tables पर rules manually run करता है
- ✅ Email, WhatsApp, और Webhook notifications भेजता है
- ✅ Dashboard पर alert logs दिखाता है

---

## 📋 Rules कैसे Test करें (How to Test Rules)

### Step 1: Login करें
```
URL: http://localhost:3000/login
Role: MIS, Manager, या Admin
```

### Step 2: File Upload करें (अगर नहीं है तो)
```
1. http://localhost:3000/uploads पर जाएं
2. CSV/Excel file upload करें (e.g., bank_statement_test.csv)
3. File को Approve करें (Manager/CEO role required)
```

### Step 3: Rule बनाएं
```
URL: http://localhost:3000/rules

Example Rule:
- Name: "Low Balance Alert"
- Column: "balance" या "amount"
- Operator: "<" (less than)
- Value: "130000"
- Action: EMAIL या WHATSAPP
- Recipient: आपका email/phone
```

### Step 4: "Test All Rules Now" Button Click करें
```
✅ यह button rules page के right side पर है
✅ यह सभी approved tables पर rules check करेगा
✅ अगर condition match होती है तो notification भेजेगा
```

---

## 📧 Notification Types

### 1. EMAIL Notifications
**Configuration:** `.env` file में
```env
SMTP_USER=chetanpachauli@gmail.com
SMTP_PASSWORD=hlogklyvzosyobmi
```

**Format:**
- Subject: 🚨 InsightAI Alert: Rule 'Rule Name' Triggered
- HTML formatted email with table details
- Dashboard link included

**Test करें:**
```
Rule Action: EMAIL
Recipient: आपका email address
```

### 2. WhatsApp Notifications
**Configuration:** Twilio sandbox
```env
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID_HERE
TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN_HERE
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Format:**
```
🚨 *InsightAI Enterprise Alert!* 🚨

*Rule Name:* Low Balance Alert
*Source Sheet:* data_bank_statement_v1
*Condition:* IF balance < 130000
*Matching Anomalies:* 5 records matched!
```

**Test करें:**
```
Rule Action: WHATSAPP
Recipient: whatsapp:+919999999999 (your number)

⚠️ Note: Twilio sandbox requires joining first
Send "join <code>" to +14155238886 from WhatsApp
```

### 3. Webhook Notifications (Slack/Discord)
**Format:** JSON payload
```json
{
  "text": "🚨 *InsightAI Alert: Rule Triggered!*",
  "attachments": [{
    "color": "#ef4444",
    "title": "Trigger Rule: Low Balance Alert",
    "fields": [
      {"title": "Table Source", "value": "data_bank_statement_v1"},
      {"title": "Matching Rows", "value": "5"}
    ]
  }]
}
```

**Test करें:**
```
Rule Action: WEBHOOK
Webhook URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 4. Dashboard Alert Logs
**Location:** http://localhost:3000/dashboard
- Real-time audit logs पर दिखता है
- "RULE_TRIGGERED" action के साथ
- हमेशा काम करता है (no config needed)

---

## 🧪 Test Cases

### Test Case 1: Bank Statement Alert
```
File: bank_statement_test.csv
Rule:
  - Name: "Low Balance Warning"
  - Column: "balance"
  - Operator: "<"
  - Value: "130000"
  - Action: EMAIL
  - Recipient: your@email.com

Expected Result:
✅ Email notification भेजा जाएगा
✅ Dashboard में "RULE_TRIGGERED" log दिखेगा
✅ 17 records match करेंगे (balance < 130000)
```

### Test Case 2: Sales Drop Alert
```
File: sales_data.xlsx (upload करें)
Rule:
  - Name: "Sales Below Threshold"
  - Column: "amount" या "sales"
  - Operator: "<"
  - Value: "50000"
  - Action: WHATSAPP
  - Recipient: whatsapp:+919999999999

Expected Result:
✅ WhatsApp message भेजा जाएगा
✅ Dashboard audit log में entry
```

### Test Case 3: Multiple Rules
```
1. Create 3 different rules
2. Click "Test All Rules Now"
3. All 3 rules will be evaluated against all approved tables

Expected Result:
✅ Message: "Tested 3 active rules against 2 approved tables"
✅ Multiple notifications (if conditions match)
```

---

## 🔧 Troubleshooting

### ❌ Email नहीं भेज रहा
**Check:**
1. `.env` में SMTP credentials correct हैं?
2. Gmail account में "Less secure app access" enabled है?
3. App Password use कर रहे हैं (2FA enabled accounts के लिए)?

**Solution:**
```bash
# Backend logs check करें
cd backend
python run.py

# Look for:
[Notification Success] Sent Alert email to ...
या
[Notification Failed] Error sending SMTP email to ...
```

### ❌ WhatsApp नहीं भेज रहा
**Check:**
1. Twilio sandbox में join किया है?
2. Phone number format: `whatsapp:+919999999999`
3. Twilio credentials correct हैं?

**Solution:**
```
1. Open WhatsApp
2. Send message to: +1 415 523 8886
3. Message: join <sandbox-code>
4. Wait for confirmation
5. Then test rule again
```

### ❌ "No approved data tables found" error
**Solution:**
```
1. Go to http://localhost:3000/uploads
2. Upload a file (CSV/Excel)
3. Approve it (as Manager/CEO)
4. Go back to Rules page
5. Click "Test All Rules Now" again
```

### ❌ Rules not triggering
**Check:**
1. Rule is **Active** (toggle should be green/right)
2. Column name matches exactly (case-sensitive)
3. Data type is correct (numeric comparison for numbers)
4. At least one row matches the condition

**Debug:**
```sql
-- Check table structure
SELECT * FROM data_bank_statement_v1 LIMIT 5;

-- Test rule condition manually
SELECT COUNT(*) FROM data_bank_statement_v1 
WHERE "balance" < 130000;

-- If count > 0, rule should trigger
```

---

## 📊 Success Indicators

### ✅ Rule Triggered Successfully
आपको ये दिखना चाहिए:

1. **Frontend Success Message:**
```
✅ Tested X active rules against Y approved tables. 
Check Dashboard for triggered alerts!
```

2. **Dashboard Audit Logs:**
```
Action: RULE_TRIGGERED
Details: Rule 'Low Balance Warning' triggered on table 
'data_bank_statement_v1'. Found 17 matching records.
```

3. **Email/WhatsApp:**
- Email inbox में notification
- WhatsApp पर message (if configured)

4. **Backend Console:**
```
[Notification Success] Sent Alert email to chetanpachauli@gmail.com
```

---

## 🚀 Next Steps

### For Development:
1. Add real-time rule checking (websockets)
2. Add rule scheduling (cron jobs)
3. Add rule templates
4. Add notification history page

### For Production:
1. Setup proper SMTP server (not Gmail)
2. Get production Twilio account
3. Add rate limiting for notifications
4. Add notification preferences per user

---

## 📝 API Endpoints

### Test All Rules (Manual Trigger)
```http
POST /api/rules/test-all
Authorization: Bearer <token>
Roles: Admin, Manager, MIS

Response:
{
  "status": "SUCCESS",
  "message": "Tested 3 active rules against 2 approved tables",
  "tables_tested": ["data_bank_statement_v1", "data_sales_v2"],
  "active_rules_count": 3
}
```

### Create Rule
```http
POST /api/rules
Authorization: Bearer <token>
Roles: Admin, Manager, MIS

Body:
{
  "name": "Low Balance Alert",
  "rule_type": "FINANCE",
  "condition_col": "balance",
  "operator": "<",
  "value": "130000",
  "action_type": "EMAIL",
  "recipient": "manager@company.com"
}
```

---

## 🎯 Quick Testing Commands

### Backend Terminal:
```bash
cd backend
python run.py

# Watch for notification logs:
# [Notification Success] or [Notification Failed]
```

### Database Check:
```sql
-- Check approved files
SELECT id, filename, workflow_status, status 
FROM uploaded_files 
WHERE workflow_status = 'APPROVED';

-- Check active rules
SELECT id, name, condition_col, operator, value, action_type, is_active 
FROM alert_rules 
WHERE is_active = true;

-- Check audit logs
SELECT action, details, timestamp 
FROM audit_logs 
WHERE action = 'RULE_TRIGGERED' 
ORDER BY timestamp DESC 
LIMIT 10;
```

---

**Created:** August 13, 2026  
**Version:** 1.0.0  
**Status:** Ready for Testing ✅
