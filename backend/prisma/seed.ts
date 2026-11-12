import { PrismaClient, Role, EmployeeStatus, LeaveStatus, LeaveType, DurationType, DecisionMethod, TokenStatus, NotificationType, DeliveryStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Durozen Leave Management System Database...');

  // Clean existing data for clean seed
  await prisma.notificationLog.deleteMany();
  await prisma.approvalToken.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.approver.deleteMany();
  await prisma.employee.deleteMany();

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  // 1. Create Director
  const director = await prisma.employee.create({
    data: {
      employeeId: 'DIR-001',
      name: 'Director Administrator',
      email: 'director@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.DIRECTOR,
      status: EmployeeStatus.ACTIVE,
      department: 'Executive Management',
      designation: 'Managing Director',
      annualQuota: 12.0,
      usedQuota: 0.0,
    },
  });

  // 2. Create HR Administrator
  const hr = await prisma.employee.create({
    data: {
      employeeId: 'HR-001',
      name: 'HR Administrator',
      email: 'hr@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.HR,
      status: EmployeeStatus.ACTIVE,
      department: 'Human Resources',
      designation: 'Head of People & Culture',
      annualQuota: 12.0,
      usedQuota: 0.0,
    },
  });

  // 3. Create Employees
  const emp1 = await prisma.employee.create({
    data: {
      employeeId: 'EMP-101',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      status: EmployeeStatus.ACTIVE,
      department: 'Engineering',
      designation: 'Senior Backend Engineer',
      annualQuota: 12.0,
      usedQuota: 2.0,
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      employeeId: 'EMP-102',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      status: EmployeeStatus.ACTIVE,
      department: 'Frontend Development',
      designation: 'Frontend Engineer',
      annualQuota: 12.0,
      usedQuota: 3.5,
    },
  });

  const emp3 = await prisma.employee.create({
    data: {
      employeeId: 'EMP-103',
      name: 'Priya Sharma',
      email: 'priya.sharma@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      status: EmployeeStatus.ACTIVE,
      department: 'Quality Assurance',
      designation: 'QA Analyst',
      annualQuota: 12.0,
      usedQuota: 1.0,
    },
  });

  const emp4 = await prisma.employee.create({
    data: {
      employeeId: 'EMP-104',
      name: 'Alex Vance',
      email: 'alex.vance@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      status: EmployeeStatus.ACTIVE,
      department: 'Product & Design',
      designation: 'Lead UI/UX Designer',
      annualQuota: 12.0,
      usedQuota: 0.0,
    },
  });

  const empInactive = await prisma.employee.create({
    data: {
      employeeId: 'EMP-105',
      name: 'Michael Scott',
      email: 'michael.scott@durozen.in',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      status: EmployeeStatus.INACTIVE,
      department: 'Operations',
      designation: 'Former Logistics Lead',
      annualQuota: 12.0,
      usedQuota: 4.0,
    },
  });

  // 4. Create Approvers
  await prisma.approver.createMany({
    data: [
      {
        approverId: 'DIR-001',
        name: 'Director Administrator',
        email: 'director@durozen.in',
        role: Role.DIRECTOR,
        status: EmployeeStatus.ACTIVE,
      },
      {
        approverId: 'HR-001',
        name: 'HR Administrator',
        email: 'hr@durozen.in',
        role: Role.HR,
        status: EmployeeStatus.ACTIVE,
      },
    ],
  });

  // 5. Create Sample Leaves
  // A) Pending leave from Sarah Jenkins
  const today = new Date();
  const nextMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
  const nextTuesday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4);

  const pendingLeave = await prisma.leaveRequest.create({
    data: {
      requestId: 'LR-2026-0001',
      employeeId: emp1.employeeId,
      employeeName: emp1.name,
      employeeEmail: emp1.email,
      managerEmail: 'director@durozen.in',
      leaveType: LeaveType.CASUAL_LEAVE,
      startDate: nextMonday,
      endDate: nextTuesday,
      duration: DurationType.FULL_DAY,
      numberOfDays: 2.0,
      reason: 'Attending family wedding and travel arrangements.',
      status: LeaveStatus.PENDING,
      submittedAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
    },
  });

  const sampleDirToken = 'demo-director-token-2026-abc123';
  const sampleHrToken = 'demo-hr-token-2026-xyz789';

  await prisma.approvalToken.createMany({
    data: [
      {
        tokenId: 'TOK-DIR-0001',
        requestId: pendingLeave.requestId,
        approverId: 'DIR-001',
        approverEmail: 'director@durozen.in',
        tokenHash: sampleDirToken,
        status: TokenStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600000),
      },
      {
        tokenId: 'TOK-HR-0001',
        requestId: pendingLeave.requestId,
        approverId: 'HR-001',
        approverEmail: 'hr@durozen.in',
        tokenHash: sampleHrToken,
        status: TokenStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600000),
      },
    ],
  });

  // Notification for pending leave
  await prisma.notificationLog.createMany({
    data: [
      {
        notificationId: 'NOTIF-0001-DIR',
        requestId: pendingLeave.requestId,
        recipientEmail: 'director@durozen.in',
        recipientRole: 'DIRECTOR',
        notificationType: NotificationType.REQUEST,
        subject: `Leave Approval Request – ${emp1.name} – ${emp1.employeeId}`,
        bodyPreview: `Leave application submitted by ${emp1.name} (${emp1.employeeId}) for 2 days from ${nextMonday.toLocaleDateString()} to ${nextTuesday.toLocaleDateString()}.`,
        deliveryStatus: DeliveryStatus.SENT,
        sentAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        notificationId: 'NOTIF-0001-HR',
        requestId: pendingLeave.requestId,
        recipientEmail: 'hr@durozen.in',
        recipientRole: 'HR',
        notificationType: NotificationType.REQUEST,
        subject: `Leave Approval Request – ${emp1.name} – ${emp1.employeeId}`,
        bodyPreview: `Leave application submitted by ${emp1.name} (${emp1.employeeId}) for 2 days from ${nextMonday.toLocaleDateString()} to ${nextTuesday.toLocaleDateString()}.`,
        deliveryStatus: DeliveryStatus.SENT,
        sentAt: new Date(Date.now() - 3600000 * 2),
      },
    ],
  });

  // B) Approved leave from Rajesh Kumar
  const pastStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10);
  const pastEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 9);

  const approvedLeave = await prisma.leaveRequest.create({
    data: {
      requestId: 'LR-2026-0002',
      employeeId: emp2.employeeId,
      employeeName: emp2.name,
      employeeEmail: emp2.email,
      managerEmail: 'hr@durozen.in',
      leaveType: LeaveType.SICK_LEAVE,
      startDate: pastStart,
      endDate: pastEnd,
      duration: DurationType.FULL_DAY,
      numberOfDays: 2.0,
      reason: 'Severe viral fever and physician-prescribed bed rest.',
      status: LeaveStatus.APPROVED,
      decidedBy: 'Director (director@durozen.in)',
      decidedByEmail: 'director@durozen.in',
      decidedAt: new Date(Date.now() - 3600000 * 48),
      decisionMethod: DecisionMethod.EMAIL,
      submittedAt: new Date(Date.now() - 3600000 * 50),
    },
  });

  await prisma.notificationLog.create({
    data: {
      notificationId: 'NOTIF-0002-APP',
      requestId: approvedLeave.requestId,
      recipientEmail: emp2.email,
      recipientRole: 'EMPLOYEE',
      notificationType: NotificationType.APPROVAL,
      subject: `Leave Request Approved – ${emp2.name}`,
      bodyPreview: `Your leave request ${approvedLeave.requestId} has been approved by Director.`,
      deliveryStatus: DeliveryStatus.SENT,
      sentAt: new Date(Date.now() - 3600000 * 48),
    },
  });

  // C) Rejected leave from Priya Sharma
  const pastStart2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15);
  const pastEnd2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 15);

  const rejectedLeave = await prisma.leaveRequest.create({
    data: {
      requestId: 'LR-2026-0003',
      employeeId: emp3.employeeId,
      employeeName: emp3.name,
      employeeEmail: emp3.email,
      managerEmail: 'hr@durozen.in',
      leaveType: LeaveType.OTHER,
      otherNote: 'Personal workshop attendance',
      startDate: pastStart2,
      endDate: pastEnd2,
      duration: DurationType.HALF_DAY_FIRST_HALF,
      numberOfDays: 0.5,
      reason: 'Need morning off to attend an external workshop.',
      status: LeaveStatus.REJECTED,
      decidedBy: 'HR Administrator (hr@durozen.in)',
      decidedByEmail: 'hr@durozen.in',
      decidedAt: new Date(Date.now() - 3600000 * 70),
      decisionMethod: DecisionMethod.PORTAL,
      rejectionRemarks: 'Critical release sprint testing scheduled during the same window. Please reschedule.',
      submittedAt: new Date(Date.now() - 3600000 * 72),
    },
  });

  await prisma.notificationLog.create({
    data: {
      notificationId: 'NOTIF-0003-REJ',
      requestId: rejectedLeave.requestId,
      recipientEmail: emp3.email,
      recipientRole: 'EMPLOYEE',
      notificationType: NotificationType.REJECTION,
      subject: `Leave Request Rejected – ${emp3.name}`,
      bodyPreview: `Your leave request ${rejectedLeave.requestId} has been rejected by HR Administrator. Remarks: Critical release sprint testing scheduled.`,
      deliveryStatus: DeliveryStatus.SENT,
      sentAt: new Date(Date.now() - 3600000 * 70),
    },
  });

  console.log('Seed completed successfully!');
  console.log('-------------------------------------------');
  console.log('Demo Credentials (All passwords: Password@123):');
  console.log('1. Director: director@durozen.in (or DIR-001)');
  console.log('2. HR Administrator: hr@durozen.in (or HR-001)');
  console.log('3. Employee: sarah.jenkins@durozen.in (or EMP-101)');
  console.log('4. Employee: rajesh.kumar@durozen.in (or EMP-102)');
  console.log('5. Inactive Employee: michael.scott@durozen.in (or EMP-105)');
  console.log('-------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
