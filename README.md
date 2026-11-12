# Durozen Technologies - Employee Leave Management System

A centralized, secure, enterprise-grade Employee Leave Management System built strictly according to the **Software Requirements Specification (SRS v1.0)** for **Durozen Technologies Private Limited** (`leave.durozen.in`).

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
| **Director** | `DIR-001` | `director@durozen.in` | Executive Approver, Full Employee & Leave Management, Analytics |
| **HR Administrator** | `HR-001` | `hr@durozen.in` | HR Approver, Employee Directory Management, Approvals, Reports |
| **Employee** | `EMP-101` | `sarah.jenkins@durozen.in` | Active Employee (Engineering): Apply Leave, View History, Cancel Pending |
| **Employee** | `EMP-102` | `rajesh.kumar@durozen.in` | Active Employee (Frontend): Leave tracking |
| **Inactive Employee** | `EMP-105` | `michael.scott@durozen.in` | Deactivated account (used to verify BR-04 & TC-19 access block) |

> **Pro Tip:** In the top navigation bar, use the **"Switch Persona: [Director] [HR Admin] [Employee]"** button to instantly switch between roles with a single click!

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
- **Manager Email ID**: Dropdown pre-populated with `director@durozen.in` and `hr@durozen.in` (SRS 4.3).
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
- Employee-wise quota tracking (12 annual days quota).
- Monthly trend charts and Leave-type utilization breakdown.
- 1-Click CSV export.

---

## 🚀 Running the System

### Backend (NestJS on `http://localhost:4000/api`)
```bash
cd backend
npm run build
node dist/src/main.js
```

### Frontend (Next.js on `http://localhost:3000`)
```bash
cd frontend
npm run build
npm start
```
