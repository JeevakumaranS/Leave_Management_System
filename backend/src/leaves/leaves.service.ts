import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { DurationType, EmployeeStatus, LeaveStatus, LeaveType, Role, TokenStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class LeavesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateLeaveDto, currentUser?: any) {
    // 1. Employee existence and active status verification (BR-04)
    const employee = await this.prisma.employee.findUnique({
      where: { employeeId: dto.employeeId.trim().toUpperCase() },
    });

    if (!employee) {
      throw new BadRequestException(`Employee with ID '${dto.employeeId}' does not exist.`);
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Inactive employees cannot submit leave applications (BR-04).');
    }

    // 2. Data Consistency (SRS 4.2): Employee ID, Name, and Email must represent the same registered employee record
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

    // 3. Leave Type & Other Note validation (SRS 4.4, BR-08)
    if (dto.leaveType === LeaveType.OTHER) {
      if (!dto.otherNote || dto.otherNote.trim().length === 0) {
        throw new BadRequestException('Other Leave Note is mandatory when Leave Type is "Other" (BR-08).');
      }
    }

    // 4. Date and Duration Validations (SRS 4.5, BR-05, BR-06)
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format provided for Start Date or End Date.');
    }

    // Reset times to compare dates accurately
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (endDateOnly < startDateOnly) {
      throw new BadRequestException('End Date cannot be earlier than Start Date (BR-05).');
    }

    const isSameDate = startDateOnly.getTime() === endDateOnly.getTime();

    if (dto.duration !== DurationType.FULL_DAY) {
      if (!isSameDate) {
        throw new BadRequestException(
          'Half-day leave is allowed only when Start Date and End Date are identical (BR-06).',
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
          managerEmail: dto.managerEmail.trim().toLowerCase(),
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
          approverId: 'DIR-001',
          approverEmail: process.env.DIRECTOR_EMAIL || 'director@durozen.in',
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
          approverId: 'HR-001',
          approverEmail: process.env.HR_EMAIL || 'hr@durozen.in',
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
        directorToken,
        hrToken,
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

    if (query.status) {
      where.status = query.status;
    }

    if (query.leaveType) {
      where.leaveType = query.leaveType;
    }

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.search) {
      const s = query.search.trim();
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

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
        include: {
          tokens: {
            select: {
              approverEmail: true,
              tokenHash: true,
              status: true,
              expiresAt: true,
            },
          },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        OR: [{ requestId: id }, { id: !isNaN(Number(id)) ? Number(id) : -1 }],
      },
      include: {
        tokens: true,
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
        data: { status: LeaveStatus.CANCELLED },
      });
    });
  }

  async getCalendarLeaves(month?: number, year?: number) {
    const y = year || new Date().getFullYear();
    const m = month ? month - 1 : new Date().getMonth();

    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59);

    return this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,
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
