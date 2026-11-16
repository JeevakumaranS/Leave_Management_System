import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { DecisionMethod, DurationType, EmployeeStatus, LeaveStatus, LeaveType, Role, TokenStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { getPagination } from '../common/pagination';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class LeavesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateLeaveDto, currentUser?: any) {
    // 1. Employee existence and active status verification (BR-04)
    const employee = await this.prisma.user.findUnique({
      where: { employeeId: dto.employeeId.trim().toUpperCase() },
    });

    if (!employee) {
      throw new BadRequestException(`Employee with ID '${dto.employeeId}' does not exist.`);
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Inactive employees cannot submit leave applications.');
    }

    // 2. Data Consistency: Employee ID, Name, and Email must represent the same registered employee record
    if (employee.name.toLowerCase().trim() !== dto.employeeName.toLowerCase().trim()) {
      throw new BadRequestException(
        `Employee Name does not match registered record for ID ${employee.employeeId}. Expected: ${employee.name}`,
      );
    }

    if (employee.email.toLowerCase().trim() !== dto.employeeEmail.toLowerCase().trim()) {
      throw new BadRequestException(
        `Employee Email does not match registered record for ID ${employee.employeeId}. Expected: ${employee.email}`,
      );
    }

    // If submitted by authenticated employee, verify they submit for themselves (unless admin)
    if (currentUser && currentUser.role === Role.EMPLOYEE && currentUser.employeeId !== employee.employeeId) {
      throw new ForbiddenException('Employees are only permitted to submit leave requests for themselves.');
    }

    const manager = await this.prisma.user.findFirst({
      where: {
        email: dto.managerEmail.trim().toLowerCase(),
        status: EmployeeStatus.ACTIVE,
        role: { in: [Role.HR, Role.DIRECTOR] },
      },
      select: { email: true },
    });
    if (!manager) {
      throw new BadRequestException('Selected manager must be an active HR or Director account.');
    }

    const activeApprovers = await this.prisma.user.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        role: { in: [Role.HR, Role.DIRECTOR] },
      },
      orderBy: { employeeId: 'asc' },
      select: {
        employeeId: true,
        name: true,
        email: true,
        role: true,
      },
    });
    const director = activeApprovers.find((approver) => approver.role === Role.DIRECTOR);
    const hr = activeApprovers.find((approver) => approver.role === Role.HR);
    if (!director || !hr) {
      throw new BadRequestException(
        'Leave requests require an active Director and an active HR account.',
      );
    }

    // 3. Leave Type & Other Note validation
    if (dto.leaveType === LeaveType.OTHER) {
      if (!dto.otherNote || dto.otherNote.trim().length === 0) {
        throw new BadRequestException('Other Leave Note is mandatory when Leave Type is "Other".');
      }
    }

    // 4. Date and Duration Validations
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format provided for Start Date or End Date.');
    }

    // Reset times to compare dates accurately
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (endDateOnly < startDateOnly) {
      throw new BadRequestException('End Date cannot be earlier than Start Date.');
    }

    const isSameDate = startDateOnly.getTime() === endDateOnly.getTime();

    if (dto.duration !== DurationType.FULL_DAY) {
      if (!isSameDate) {
        throw new BadRequestException(
          'Half-day leave is allowed only when Start Date and End Date are identical.',
        );
      }
    }

    // Calculate number of days
    let numberOfDays = 0;
    if (dto.duration === DurationType.HALF_DAY_FIRST_HALF || dto.duration === DurationType.HALF_DAY_SECOND_HALF) {
      numberOfDays = 0.5;
    } else {
      const diffTime = Math.abs(endDateOnly.getTime() - startDateOnly.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      numberOfDays = diffDays;
    }

    // Check reason mandatory
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Reason for Leave cannot be empty.');
    }

    // 5. Date overlap check (PD-07)
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        OR: [
          {
            startDate: { lte: endDateOnly },
            endDate: { gte: startDateOnly },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Leave conflict: An active request (${overlapping.requestId} - ${overlapping.status}) already exists covering these dates.`,
      );
    }

    // 6. Generate Unique Leave Request ID (e.g. LR-2026-0001)
    const currentYear = new Date().getFullYear();
    const count = await this.prisma.leaveRequest.count();
    const sequenceNumber = (count + 1).toString().padStart(4, '0');
    const requestId = `LR-${currentYear}-${sequenceNumber}`;

    // 7. Atomic transaction to create LeaveRequest + Tokens
    const directorToken = crypto.randomBytes(32).toString('hex');
    const hrToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const created = await this.prisma.$transaction(async (tx) => {
      const leave = await tx.leaveRequest.create({
        data: {
          requestId,
          employeeId: employee.employeeId,
          employeeName: employee.name,
          employeeEmail: employee.email,
          managerEmail: manager.email,
          leaveType: dto.leaveType,
          otherNote: dto.leaveType === LeaveType.OTHER ? dto.otherNote?.trim() : null,
          startDate: startDateOnly,
          endDate: endDateOnly,
          duration: dto.duration,
          numberOfDays,
          reason: dto.reason.trim(),
          status: LeaveStatus.PENDING,
        },
      });

      // Create Director token
      await tx.approvalToken.create({
        data: {
          tokenId: `TOK-DIR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          requestId: leave.requestId,
          approverId: director.employeeId,
          approverEmail: director.email,
          tokenHash: directorToken,
          expiresAt,
          status: TokenStatus.ACTIVE,
        },
      });

      // Create HR token
      await tx.approvalToken.create({
        data: {
          tokenId: `TOK-HR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          requestId: leave.requestId,
          approverId: hr.employeeId,
          approverEmail: hr.email,
          tokenHash: hrToken,
          expiresAt,
          status: TokenStatus.ACTIVE,
        },
      });

      return leave;
    });

    // 8. Send notification emails asynchronously to Director and HR (SRS 6.1)
    this.notificationsService
      .sendLeaveRequestNotifications({
        request: created,
        approvers: [
          { ...director, token: directorToken },
          { ...hr, token: hrToken },
        ],
      })
      .catch((err) => console.error('Error sending request notification:', err));

    return created;
  }

  async getMyLeaves(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { submittedAt: 'desc' },
      include: {
        tokens: {
          select: {
            approverEmail: true,
            status: true,
          },
        },
      },
    });
  }

  async getAll(query: {
    search?: string;
    status?: LeaveStatus;
    leaveType?: LeaveType;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    const status = query.status?.trim();
    if (status && status.toLowerCase() !== 'undefined') {
      const validStatus = Object.values(LeaveStatus).find((value) => value === status);
      if (!validStatus) {
        throw new BadRequestException(`Invalid leave status '${status}'.`);
      }
      where.status = validStatus;
    }

    const leaveType = query.leaveType?.trim();
    if (leaveType && leaveType.toLowerCase() !== 'undefined') {
      const validLeaveType = Object.values(LeaveType).find((value) => value === leaveType);
      if (!validLeaveType) {
        throw new BadRequestException(`Invalid leave type '${leaveType}'.`);
      }
      where.leaveType = validLeaveType;
    }

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    const search = query.search?.trim();
    if (search && search.toLowerCase() !== 'undefined') {
      const s = search;
      where.OR = [
        { requestId: { contains: s, mode: 'insensitive' } },
        { employeeId: { contains: s, mode: 'insensitive' } },
        { employeeName: { contains: s, mode: 'insensitive' } },
        { employeeEmail: { contains: s, mode: 'insensitive' } },
        { reason: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.year) {
      const y = Number(query.year);
      const mStart = query.month ? Number(query.month) - 1 : 0;
      const mEnd = query.month ? Number(query.month) : 12;
      where.startDate = {
        gte: new Date(y, mStart, 1),
        lt: new Date(y, mEnd, 1),
      };
    } else if (query.startDate && query.endDate) {
      where.startDate = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate),
      };
    }

    const total = await this.prisma.leaveRequest.count({ where });
    const { page, limit, totalPages } = getPagination(query.page, query.limit, total);
    const items = await this.prisma.leaveRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tokens: {
            select: {
              approverEmail: true,
              status: true,
              expiresAt: true,
            },
          },
        },
      });

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getById(id: string) {
    const where = UUID_V7_PATTERN.test(id) ? { id } : { requestId: id };
    const leave = await this.prisma.leaveRequest.findUnique({
      where,
      include: {
        tokens: {
          select: {
            tokenId: true,
            approverId: true,
            approverEmail: true,
            status: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
          },
        },
        notifications: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!leave) throw new NotFoundException('Leave request not found');
    return leave;
  }

  async cancelLeave(requestId: string, currentUser: any) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { requestId },
    });

    if (!leave) throw new NotFoundException('Leave request not found');

    if (currentUser.role === Role.EMPLOYEE && currentUser.employeeId !== leave.employeeId) {
      throw new ForbiddenException('You can only cancel your own leave requests.');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel leave request in '${leave.status}' status. Only PENDING requests can be cancelled.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Invalidate tokens
      await tx.approvalToken.updateMany({
        where: { requestId: leave.requestId },
        data: { status: TokenStatus.REVOKED },
      });

      return tx.leaveRequest.update({
        where: { requestId: leave.requestId },
        data: {
          status: LeaveStatus.CANCELLED,
          decidedBy: currentUser.role === Role.EMPLOYEE ? 'Cancelled by Employee' : `Cancelled by ${currentUser.name || currentUser.role}`,
          decidedByEmail: currentUser.email,
          decidedAt: new Date(),
          decisionMethod: DecisionMethod.PORTAL,
        },
      });
    });
  }

  async getCalendarLeaves(
    month: number | undefined,
    year: number | undefined,
    currentUser: { role: Role; employeeId: string },
  ) {
    const y = year || new Date().getFullYear();
    const m = month ? month - 1 : new Date().getMonth();

    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59);

    return this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,
        ...(currentUser.role === Role.EMPLOYEE ? { employeeId: currentUser.employeeId } : {}),
        OR: [
          {
            startDate: { lte: endOfMonth },
            endDate: { gte: startOfMonth },
          },
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }
}
