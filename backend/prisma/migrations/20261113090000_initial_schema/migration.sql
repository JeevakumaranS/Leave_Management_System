-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'HR', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL_LEAVE', 'SICK_LEAVE', 'EMERGENCY_LEAVE', 'OTHER');

-- CreateEnum
CREATE TYPE "DurationType" AS ENUM ('FULL_DAY', 'HALF_DAY_FIRST_HALF', 'HALF_DAY_SECOND_HALF');

-- CreateEnum
CREATE TYPE "DecisionMethod" AS ENUM ('PORTAL', 'EMAIL');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST', 'APPROVAL', 'REJECTION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "department" TEXT NOT NULL DEFAULT 'General',
    "designation" TEXT,
    "annual_quota" DOUBLE PRECISION NOT NULL DEFAULT 12.0,
    "used_quota" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "request_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "employee_email" TEXT NOT NULL,
    "manager_email" TEXT NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "other_note" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "duration" "DurationType" NOT NULL DEFAULT 'FULL_DAY',
    "number_of_days" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" TEXT,
    "decided_by_email" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_method" "DecisionMethod",
    "rejection_remarks" TEXT,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvers" (
    "id" SERIAL NOT NULL,
    "approver_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tokens" (
    "id" SERIAL NOT NULL,
    "token_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "approver_email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" SERIAL NOT NULL,
    "notification_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_role" TEXT,
    "notification_type" "NotificationType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body_preview" TEXT,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_id_key" ON "employees"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_request_id_key" ON "leave_requests"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvers_approver_id_key" ON "approvers"("approver_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvers_email_key" ON "approvers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "approval_tokens_token_id_key" ON "approval_tokens"("token_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_tokens_token_hash_key" ON "approval_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_notification_id_key" ON "notification_logs"("notification_id");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tokens" ADD CONSTRAINT "approval_tokens_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;
