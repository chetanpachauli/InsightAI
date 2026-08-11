# InsightAI: Enterprise MIS & AI Analytics SaaS Platform

InsightAI is a high-performance full-stack data analytics and continuous integration platform designed for modern business operations. It automates Excel/CSV ingestion, offers role-based approval workflows, dynamic pivot-table reports, vector RAG document searches, manual message dispatches (Email & WhatsApp), and local Jenkins CI/CD pipelines.

---

## Key Features

1. **AI-Powered natural Language Analytics Chat**: Users ask questions in plain English/Hinglish (e.g. *"Show me total sales per region"*), and the system dynamically generates PostgreSQL queries using Gemini models and renders interactive charts (Bar, Line, Pie).
2. **Multi-Tier File Approval Workflow**: Supporting strict role access permissions:
   - **MIS (Operator)**: Uploads Excel sheets.
   - **Manager**: Reviews data lineage logs and rules logs, then approves/rejects drafts.
   - **CEO**: Views overall executive charts and grants final sign-off.
3. **Automated IF/THEN Rules Engine**: Automatically scans data uploads and triggers Slack webhooks, HTML SMTP emails, and Twilio WhatsApp notifications if thresholds (e.g., Sales < 500) are breached.
4. **Dynamic Pivot Table Builder**: Drag and configure aggregate matrices (SUM, AVG, COUNT) dynamically on any approved sheet.
5. **AI Document Q&A (RAG Engine)**: Upload files (e.g., standard manuals) and search them semantically using cosine vector similarity and Gemini embeddings.
6. **Notification Dispatch Center**: Send manual, styled HTML emails and sandbox Twilio WhatsApp notifications directly from the UI.
7. **Personal Finance AI Tracker**: Upload bank statements, let Gemini auto-categorize expenses, and override categories dynamically with real-time recalculations.
8. **AI Web Scraper**: Input any website URL and extract structured items (e.g., products, prices, news headlines) directly to downloadable CSV spreadsheets.

---

## Tech Stack

* **Backend**: FastAPI (Python), Polars (Fast data processing), PostgreSQL (Database), Redis (Task Queue), SQLAlchemy, Google GenAI SDK.
* **Frontend**: Next.js (React, TypeScript), Recharts (Visual graphs), Tailwind CSS, Lucide Icons.
* **DevOps**: Docker & Docker Compose, GitHub Actions, Jenkins.

---

## Setup Instructions

### 1. Docker Environment Setup
Ensure **Docker Desktop** is running, then start the containers:
```bash
docker compose up -d
```

### 2. Frontend Development Server
Navigate to the frontend folder and run:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 3. Voice Assistant Execution
To launch the Windows local voice assistant:
```bash
pip install pyttsx3 speechrecognition pyaudio httpx
python voice_assistant.py
```
