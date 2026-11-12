import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeeStatus, LeaveStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getAdminDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tonight = new Date(today);
    tonight.setHours(23, 59, 59, 999);

    const [
      totalEmployees,
      activeEmployees,
      pendingLeaves,
      approvedLeaves,
      rejectedLeaves,
      cancelledLeaves,
      todayOnLeaveCount,
      recentPending,
    ] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: EmployeeStatus.ACTIVE } }),
      this.prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
      this.prisma.leaveRequest.count({ where: { status: LeaveStatus.APPROVED } }),
      this.prisma.leaveRequest.count({ where: { status: LeaveStatus.REJECTED } }),
      this.prisma.leaveRequest.count({ where: { status: LeaveStatus.CANCELLED } }),
      this.prisma.leaveRequest.count({
        where: {
          status: LeaveStatus.APPROVED,
          startDate: { lte: tonight },
          endDate: { gte: today },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.PENDING },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalEmployees,
      activeEmployees,
      pendingLeaves,
      approvedLeaves,
      rejectedLeaves,
      cancelledLeaves,
      todayOnLeaveCount,
      recentPending,
    };
  }

  async getEmployeeDashboardStats(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeId },
    });

    const [totalRequests, pendingRequests, approvedRequests, rejectedRequests, cancelledRequests, recent] =
      await Promise.all([
        this.prisma.leaveRequest.count({ where: { employeeId } }),
        this.prisma.leaveRequest.count({ where: { employeeId, status: LeaveStatus.PENDING } }),
        this.prisma.leaveRequest.count({ where: { employeeId, status: LeaveStatus.APPROVED } }),
        this.prisma.leaveRequest.count({ where: { employeeId, status: LeaveStatus.REJECTED } }),
        this.prisma.leaveRequest.count({ where: { employeeId, status: LeaveStatus.CANCELLED } }),
        this.prisma.leaveRequest.findMany({
          where: { employeeId },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
      ]);

    return {
      employee: {
        employeeId: employee?.employeeId,
        name: employee?.name,
        email: employee?.email,
        annualQuota: employee?.annualQuota || 12,
        usedQuota: employee?.usedQuota || 0,
        remainingQuota: Math.max(0, (employee?.annualQuota || 12) - (employee?.usedQuota || 0)),
      },
      stats: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        cancelledRequests,
      },
      recentApplications: recent,
    };
  }

  async getLeaveAnalytics() {
    // 1. Leave Type Distribution (Approved only per SRS 9)
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: { status: LeaveStatus.APPROVED },
      select: { leaveType: true, numberOfDays: true },
    });

    const leaveTypeCounts: Record<string, { count: number; totalDays: number }> = {
      CASUAL_LEAVE: { count: 0, totalDays: 0 },
      SICK_LEAVE: { count: 0, totalDays: 0 },
      EMERGENCY_LEAVE: { count: 0, totalDays: 0 },
      OTHER: { count: 0, totalDays: 0 },
    };

    approvedLeaves.forEach((l) => {
      if (leaveTypeCounts[l.leaveType]) {
        leaveTypeCounts[l.leaveType].count++;
        leaveTypeCounts[l.leaveType].totalDays += l.numberOfDays;
      }
    });

    // 2. Monthly Trend (Current Year)
    const currentYear = new Date().getFullYear();
    const allLeavesThisYear = await this.prisma.leaveRequest.findMany({
      where: {
        startDate: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1),
        },
      },
      select: {
        startDate: true,
        status: true,
        numberOfDays: true,
      },
    });

    const monthlyTrends = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(currentYear, i, 1).toLocaleString('default', { month: 'short' }),
      monthIndex: i + 1,
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    }));

    allLeavesThisYear.forEach((l) => {
      const monthIdx = new Date(l.startDate).getMonth();
      monthlyTrends[monthIdx].total++;
      if (l.status === LeaveStatus.APPROVED) monthlyTrends[monthIdx].approved++;
      if (l.status === LeaveStatus.REJECTED) monthlyTrends[monthIdx].rejected++;
      if (l.status === LeaveStatus.PENDING) monthlyTrends[monthIdx].pending++;
    });

    // 3. Employee-wise Leave Breakdown
    const employees = await this.prisma.employee.findMany({
      select: {
        employeeId: true,
        name: true,
        department: true,
        annualQuota: true,
        usedQuota: true,
        leaveRequests: {
          select: {
            status: true,
            numberOfDays: true,
          },
        },
      },
    });

    const employeeSummary = employees.map((emp) => {
      const approvedCount = emp.leaveRequests.filter((r) => r.status === LeaveStatus.APPROVED).length;
      const pendingCount = emp.leaveRequests.filter((r) => r.status === LeaveStatus.PENDING).length;
      const rejectedCount = emp.leaveRequests.filter((r) => r.status === LeaveStatus.REJECTED).length;

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        department: emp.department,
        annualQuota: emp.annualQuota,
        usedDays: emp.usedQuota,
        remainingDays: Math.max(0, emp.annualQuota - emp.usedQuota),
        approvedCount,
        pendingCount,
        rejectedCount,
      };
    });

    return {
      leaveTypeDistribution: leaveTypeCounts,
      monthlyTrends,
      employeeSummary,
    };
  }

  async generateCsvData(filters?: { status?: LeaveStatus; year?: number }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.year) {
      where.startDate = {
        gte: new Date(filters.year, 0, 1),
        lt: new Date(filters.year + 1, 0, 1),
      };
    }

    const leaves = await this.prisma.leaveRequest.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    });

    // CSV Headers
    const headers = [
      'Request ID',
      'Employee ID',
      'Employee Name',
      'Employee Email',
      'Leave Type',
      'Start Date',
      'End Date',
      'Duration',
      'Days',
      'Status',
      'Reason',
      'Decided By',
      'Decided At',
      'Decision Method',
      'Rejection Remarks',
    ];

    const rows = leaves.map((l) => [
      l.requestId,
      l.employeeId,
      `"${l.employeeName.replace(/"/g, '""')}"`,
      l.employeeEmail,
      l.leaveType,
      l.startDate.toISOString().split('T')[0],
      l.endDate.toISOString().split('T')[0],
      l.duration,
      l.numberOfDays,
      l.status,
      `"${l.reason.replace(/"/g, '""')}"`,
      `"${(l.decidedBy || '').replace(/"/g, '""')}"`,
      l.decidedAt ? l.decidedAt.toISOString() : '',
      l.decisionMethod || '',
      `"${(l.rejectionRemarks || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
