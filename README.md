# Durozen Technologies - Employee Leave Management System

A centralized, modern, enterprise-grade Employee Leave Management System developed for **Durozen Technologies**. The platform streamlines leave applications, provides a dual-authority approval workflow for Directors and HR Administrators, automatically tracks leave quotas, and dispatches instant email notifications.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 15 (React 19, App Router, TypeScript)
- **Backend**: NestJS (TypeScript, Modular Architecture)
- **Database**: PostgreSQL
- **ORM**: Prisma Client v6
- **Authentication**: JWT & Role-Based Access Control (RBAC) with bcrypt password hashing
- **Email Notifications**: Google Apps Script Web App Integration
- **Containerization**: Docker & Docker Compose

---

## ✨ Key Features

- **Employee Portal**:
  - Submit leave applications with date pickers, duration options (Full Day / Half Day), and leave categories (Casual, Sick, Emergency, Other).
  - Real-time leave balance and remaining quota indicators.
  - Track application status in real-time (Pending, Approved, Rejected, Cancelled).
  - Ability to cancel pending applications before a decision is made.
- **Director & HR Management**:
  - Unified pending queue with one-click approval and rejection with mandatory remarks.
  - **Dual-Authority Workflow**: Both Director and HR receive every leave application; the first valid decision recorded becomes final and updates across the platform.
  - Full Employee Directory CRUD with soft activation/deactivation.
  - Interactive Company Leave Calendar showing approved employee leaves.
  - Analytics & Reports with date/department filtering and 1-click CSV export.
- **Secure Email Notifications**:
  - Instant automated emails dispatched to approvers and employees for requests, approvals, and rejections.
  - One-click secure token authorization links for fast review.

---

## 💻 Local Setup Guide

### 1. Prerequisites
- **Node.js**: v18.x or v20.x or higher
- **npm**: v9.x or higher
- **PostgreSQL**: Running locally on port `5432`

---

### 2. Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Leave_Management_System
   ```

2. **Install root dependencies**:
   ```bash
   npm install
   ```

3. **Install backend dependencies**:
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

---

### 3. Environment Configuration

1. **Backend Environment** (`backend/.env`):
   Create `backend/.env` (copy from `backend/.env.example`):
   ```env
   PORT=4000
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/durozen_leave_db"
   JWT_SECRET="your-secure-jwt-secret-key-at-least-32-chars"
   JWT_EXPIRES_IN_MINUTES=10080
   APP_URL="http://localhost:3000"

   # Email service (Google Apps Script)
   APPSCRIPT_ENABLED=false
   APPSCRIPT_WEB_APP_URL=""
   APPSCRIPT_SHARED_SECRET=""
   ```

2. **Frontend Environment** (`frontend/.env.local`):
   Create `frontend/.env.local` (copy from `frontend/.env.example`):
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:4000/api"
   ```

---

### 4. Database Setup

From the `backend` folder, generate the Prisma client and apply database migrations:

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
cd ..
```

After migrating the database, create your initial Director administrator account using the interactive CLI:
```bash
npm run create:director
```

---

### 5. Running the Application

You can start both backend and frontend simultaneously with hot-reload from the root directory:

```bash
npm run dev
```

Alternatively, run each service in separate terminals:

- **Backend** (NestJS):
  ```bash
  cd backend
  npm run start:dev
  # API running at http://localhost:4000/api
  ```

- **Frontend** (Next.js):
  ```bash
  cd frontend
  npm run dev
  # Web application running at http://localhost:3000
  ```

---

## 🐳 Docker Setup Guide

The application includes a production-ready `compose.yaml` setup containing PostgreSQL, NestJS API, and the Next.js frontend.

### 1. Configure Docker Environment Files

1. Create the root `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   ```env
   POSTGRES_DB=durozen_leave_db
   POSTGRES_USER=durozen
   POSTGRES_PASSWORD=your_secure_db_password
   FRONTEND_PORT=3000
   BACKEND_PORT=4000
   APP_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:4000/api
   ```

2. Ensure `backend/.env` has a strong `JWT_SECRET`:
   ```env
   JWT_SECRET="your-strong-production-jwt-secret"
   ```

### 2. Build and Start the Containers

Run Docker Compose from the root directory:

```bash
docker compose up --build -d
```

### 3. Verify Container Status & Logs

Check container health:
```bash
docker compose ps
```

View live logs:
```bash
docker compose logs -f
```

- **Frontend**: Accessible at `http://localhost:3000`
- **Backend API**: Accessible at `http://localhost:4000/api`
- **Database Volume**: Data is stored persistently in the `postgres-data` Docker volume.

### 4. Stopping Containers

```bash
docker compose down
```
*(To stop and remove database volumes, use `docker compose down -v`)*

---

## 🔐 How to Create Director Accounts

The system includes a secure, interactive CLI tool to create Director accounts without resetting existing database data or exposing passwords in shell history.

### Option A: Running from Local Terminal

From the root project directory, run:
```bash
npm run create:director
```
*(Or navigate to `cd backend && npm run create:director`)*

### Option B: Running inside Docker Container

If running with Docker Compose:
```bash
docker compose exec -it backend npm run create:director
```

### Interactive Prompts:
The script will prompt you for:
1. **Director full name**: e.g. `John Doe`
2. **Employee ID**: e.g. `DIR-002` (automatically formatted in uppercase)
3. **Email**: e.g. `johndoe@durozen.com` (validated format)
4. **Department**: Default is `Executive Management` (press Enter to accept default)
5. **Designation**: Default is `Director` (press Enter to accept default)
6. **Password (hidden)**: Enter a secure password (minimum 12 characters; characters are masked)
7. **Confirm password**: Re-enter password for verification
8. **Confirmation**: Type `y` or `yes` to finalize creation.

Once created, the new Director can immediately sign in at `http://localhost:3000/login` using either their **Email** or **Employee ID**.

---

## 📁 Project Directory Structure

```text
Leave_Management_System/
├── backend/                  # NestJS backend API
│   ├── prisma/               # Prisma schema and database migrations
│   ├── src/
│   │   ├── approvals/        # Dual-authority review and decision logic
│   │   ├── auth/             # JWT auth, login, RBAC guards, password change
│   │   ├── cli/              # CLI tools (create-director.ts)
│   │   ├── employees/        # Employee management CRUD & directory
│   │   ├── leaves/           # Leave application, cancellation, quota calculations
│   │   ├── notifications/    # Transactional email service & audit logs
│   │   └── reports/          # Admin stats, calendar events, CSV exports
│   └── Dockerfile            # Backend Docker image specification
├── frontend/                 # Next.js 15 client
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/        # Admin views (employees, leaves, pending, reports)
│   │   │   ├── apply-leave/  # Leave submission form
│   │   │   ├── calendar/     # Interactive company leave calendar
│   │   │   ├── dashboard/    # Responsive employee & admin dashboard
│   │   │   ├── decision/     # Token authorization decision portal
│   │   │   └── login/        # Responsive authentication page
│   │   └── components/       # Reusable components (Navbar, Sidebar, Modals)
│   └── Dockerfile            # Frontend Docker image specification
├── scripts/                  # Development orchestration scripts
├── compose.yaml              # Docker Compose multi-service definition
└── README.md                 # Project documentation
```

---

## 📄 License

This software is proprietary and confidential to **Durozen Technologies Private Limited**.
