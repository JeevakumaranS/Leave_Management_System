import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeeStatus, LeaveStatus, LeaveType, Prisma } from "@prisma/client";

export interface ReportFilters {
  search?: string;
  employeeId?: string;
  status?: string;
  leaveType?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getReportRecords(filters: ReportFilters = {}) {
    const where: Prisma.LeaveRequestWhereInput = {};

    const search = filters.search?.trim();
    if (search && search.toLowerCase() !== "undefined") {
      where.OR = [
        { requestId: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
        { employeeName: { contains: search, mode: "insensitive" } },
        { employeeEmail: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } },
        { otherNote: { contains: search, mode: "insensitive" } },
      ];
    }

    const employeeId = filters.employeeId?.trim();
    if (employeeId && employeeId.toLowerCase() !== "undefined") {
      where.employeeId = employeeId.toUpperCase();
    }

    const status = filters.status?.trim();
    if (status && status.toLowerCase() !== "undefined") {
      if (!Object.values(LeaveStatus).includes(status as LeaveStatus)) {
        throw new BadRequestException(`Invalid leave status '${status}'.`);
      }
      where.status = status as LeaveStatus;
    }

    const leaveType = filters.leaveType?.trim();
    if (leaveType && leaveType.toLowerCase() !== "undefined") {
      if (!Object.values(LeaveType).includes(leaveType as LeaveType)) {
        throw new BadRequestException(`Invalid leave type '${leaveType}'.`);
      }
      where.leaveType = leaveType as LeaveType;
    }

    const dateFrom = this.parseReportDate(filters.dateFrom, false);
    const dateTo = this.parseReportDate(filters.dateTo, true);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException(
        "The report start date must be on or before the end date.",
      );
    }

    const dateOverlapFilters: Prisma.LeaveRequestWhereInput[] = [];
    if (dateTo) dateOverlapFilters.push({ startDate: { lte: dateTo } });
    if (dateFrom) dateOverlapFilters.push({ endDate: { gte: dateFrom } });
    if (dateOverlapFilters.length) {
      where.AND = dateOverlapFilters;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      select: {
        requestId: true,
        employeeId: true,
        employeeName: true,
        employeeEmail: true,
        employee: { select: { department: true, designation: true } },
        leaveType: true,
        otherNote: true,
        startDate: true,
        endDate: true,
        duration: true,
        numberOfDays: true,
        reason: true,
        status: true,
        submittedAt: true,
      },
    });
  }

  private parseReportDate(
    value: string | undefined,
    endOfDay: boolean,
  ): Date | undefined {
    if (!value) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new BadRequestException(
        `Invalid report date '${value}'. Use YYYY-MM-DD.`,
      );
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    );
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new BadRequestException(
        `Invalid report date '${value}'. Use YYYY-MM-DD.`,
      );
    }
    return date;
  }

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
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: EmployeeStatus.ACTIVE } }),
      this.prisma.leaveRequest.count({
        where: { status: LeaveStatus.PENDING },
      }),
      this.prisma.leaveRequest.count({
        where: { status: LeaveStatus.APPROVED },
      }),
      this.prisma.leaveRequest.count({
        where: { status: LeaveStatus.REJECTED },
      }),
      this.prisma.leaveRequest.count({
        where: { status: LeaveStatus.CANCELLED },
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: LeaveStatus.APPROVED,
          startDate: { lte: tonight },
          endDate: { gte: today },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: { status: LeaveStatus.PENDING },
        orderBy: { submittedAt: "desc" },
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
    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      cancelledRequests,
      takenLeaveDays,
      recent,
    ] = await Promise.all([
      this.prisma.leaveRequest.count({ where: { employeeId } }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: LeaveStatus.PENDING },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: LeaveStatus.APPROVED },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: LeaveStatus.REJECTED },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: LeaveStatus.CANCELLED },
      }),
      this.prisma.leaveRequest.aggregate({
        where: { employeeId, status: LeaveStatus.APPROVED },
        _sum: { numberOfDays: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId },
        orderBy: { submittedAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      stats: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        cancelledRequests,
        takenLeaveDays: takenLeaveDays._sum.numberOfDays ?? 0,
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

    const leaveTypeCounts: Record<
      string,
      { count: number; totalDays: number }
    > = {
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
      month: new Date(currentYear, i, 1).toLocaleString("default", {
        month: "short",
      }),
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
    const employees = await this.prisma.user.findMany({
      select: {
        employeeId: true,
        name: true,
        department: true,
        leaveRequests: {
          select: {
            status: true,
          },
        },
      },
    });

    const employeeSummary = employees.map((emp) => {
      const approvedCount = emp.leaveRequests.filter(
        (r) => r.status === LeaveStatus.APPROVED,
      ).length;
      const pendingCount = emp.leaveRequests.filter(
        (r) => r.status === LeaveStatus.PENDING,
      ).length;
      const rejectedCount = emp.leaveRequests.filter(
        (r) => r.status === LeaveStatus.REJECTED,
      ).length;

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        department: emp.department,
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
      orderBy: { submittedAt: "desc" },
    });

    // CSV Headers
    const headers = [
      "Request ID",
      "Employee ID",
      "Employee Name",
      "Employee Email",
      "Leave Type",
      "Start Date",
      "End Date",
      "Duration",
      "Days",
      "Status",
      "Reason",
      "Decided By",
      "Decided At",
      "Decision Method",
      "Rejection Remarks",
    ];

    const toDDMMYYYY = (d: Date | null | undefined) => {
      if (!d) return "";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const rows = leaves.map((l) => [
      l.requestId,
      l.employeeId,
      `"${l.employeeName.replace(/"/g, '""')}"`,
      l.employeeEmail,
      l.leaveType,
      toDDMMYYYY(l.startDate),
      toDDMMYYYY(l.endDate),
      l.duration,
      l.numberOfDays,
      l.status,
      `"${l.reason.replace(/"/g, '""')}"`,
      `"${(l.decidedBy || "").replace(/"/g, '""')}"`,
      l.decidedAt ? toDDMMYYYY(l.decidedAt) : "",
      l.decisionMethod || "",
      `"${(l.rejectionRemarks || "").replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
