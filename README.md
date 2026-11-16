# Durozen Technologies - Employee Leave Management System

A centralized, secure, enterprise-grade Employee Leave Management System built strictly according to the **Software Requirements Specification (SRS v1.0)** for **Durozen Technologies Private Limited**.

---

## 🛠️ Technology Stack
- **Frontend**: Next.js 15 (React 19, App Router)
- **Primary Typography**: **Montserrat** with `sans-serif` fallback (per design system specifications)
- **Backend**: NestJS (TypeScript, Modular Architecture)
- **Database**: PostgreSQL (port 5432, database: `durozen_leave_db`)
- **ORM**: Prisma Client v6
- **Authentication**: JWT & Role-Based Access Control (RBAC) with bcrypt password hashing

---

## 👥 Demo User Accounts (Pre-Seeded)
All accounts use password: `Password@123`

| Role | Employee ID | Email | Permissions & Purpose |
| :--- | :--- | :--- | :--- |
| **Director** | `DIR-001` | `director@example.test` | Executive Approver, Full Employee & Leave Management, Analytics |
| **HR Administrator** | `HR-001` | `hr@example.test` | HR Approver, Employee Directory Management, Approvals, Reports |
| **Employee** | `EMP-101` | `sarah.jenkins@example.test` | Active Employee (Engineering): Apply Leave, View History, Cancel Pending |
| **Employee** | `EMP-102` | `rajesh.kumar@example.test` | Active Employee (Frontend): Leave tracking |
| **Inactive Employee** | `EMP-105` | `michael.scott@example.test` | Deactivated account (used to verify BR-04 & TC-19 access block) |

---

## 📋 SRS Requirements & Feature Matrix

### 1. User Roles and Access Control (SRS Section 2)
- **Employee**: Secure login, apply for leave, view own leave history, check status, cancel pending leaves.
- **HR & Director**: Administrative dashboards, review leave queues, approve/reject requests, employee directory CRUD, activate/deactivate accounts, company calendar, executive analytics.
- **Role Permission Matrix**: Strict server-side route guards enforcing RBAC (BR-01 to BR-16).

### 2. Employee Management Module (SRS Section 3)
- **Add Employee**: Unique Employee ID, Name, Email, Department, Designation, and Status.
- **Dynamic Dropdown**: Newly created employees automatically appear in the leave application form dropdowns without manual updates (SRS 3.3).
- **Soft Deactivation**: Historical employee records are preserved; deactivation blocks logins and leave submissions while preserving leave history (BR-16).

### 3. Leave Application Module (SRS Section 4)
- **Dynamic Field Consistency**: Selecting either Employee ID or Name automatically populates the other and sets the registered email (SRS 4.2).
- **Manager Email ID**: Dropdown populated from active HR and Director accounts in the database (SRS 4.3).
- **Leave Categories**: Casual Leave (PL), Sick Leave, Emergency Leave, Other. Selecting "Other" dynamically shows and mandates the "Other Leave Note" field (SRS 4.4, BR-08).
- **Strict Date & Duration Validation**:
  - End Date must be $\ge$ Start Date (BR-05).
  - Half-day leave allowed **only** when Start Date and End Date are identical (BR-06).
  - Multi-day selections permit only Full Day (SRS 4.5).
  - Real-time client and server validation.

### 4. Dual Approver Workflow & Critical Security (SRS Section 5, 6, 12)
- **Dual Routing**: Both Director and HR receive every leave request.
- **Atomic Decision**: Either Director or HR can approve or reject; both approvals are not required. The first valid decision becomes final (BR-11, BR-12).
- **Link Invalidation**: Once decided, any subsequent attempt by the other approver is safely rejected with "Already Decided" and full audit metadata (TC-13).
- **Rejection Remarks**: Mandatory explanatory remarks entered by the approver and recorded in the audit trail (SRS 6.3).
- **Email Action Gateway (`/decision?token=...`)**: Token verification and approver confirmation prevents unauthorized public action links (SRS Section 12).

### 5. Notifications & Audit Logs (SRS Section 6, 10.5)
- Notification logs table recording `notification_id`, `request_id`, `recipient_email`, `notification_type`, `delivery_status`, and timestamps.
- Built-in notification log viewer and retry action for failed dispatches.

### 6. Leave Calendar & Analytics (SRS Section 7, 8, 9)
- Interactive monthly company leave calendar.
- Monthly trend charts and Leave-type utilization breakdown.
- 1-Click CSV export.

---

## 🚀 Running the System

### Development mode
Run the application from the repository root with automatic backend restarts and frontend hot reload on source changes:
```bash
npm run dev
```
The watcher monitors application source code. Changes to environment files, dependencies, or the Prisma schema still require the appropriate restart, install, or Prisma client generation.

Use `npm start` to run the prebuilt production backend and frontend.

### Backend (NestJS)
Configure `backend/.env` using `backend/.env.example`, including `PORT`, `DATABASE_URL`, and `JWT_SECRET`.
To create a Director account without resetting existing database data, run `npm run create:director` from the `backend` directory and follow the prompts. The password is entered without being displayed.
```bash
cd backend
npm run build
node dist/src/main.js
```

### Frontend (Next.js)
Configure `frontend/.env.local` with `NEXT_PUBLIC_API_URL`, using `frontend/.env.example` as a template.
```bash
cd frontend
npm run build
npm start
```

### Docker Compose
Copy the root `.env.example` to `.env`, then copy `backend/.env.example` to `backend/.env`. Set a URL-safe PostgreSQL password in the root `.env` and a strong `JWT_SECRET` in `backend/.env`.
```bash
docker compose up --build
```
The frontend is available at `http://localhost:3000` and the API at `http://localhost:4000/api`. The backend applies Prisma migrations before starting, and PostgreSQL data is kept in the `postgres-data` volume. Configure `APP_URL` and `NEXT_PUBLIC_API_URL` in the root `.env` to match the public frontend and API addresses before deployment. Do not use sample credentials in production.
