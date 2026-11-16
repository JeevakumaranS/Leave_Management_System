import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import * as bcrypt from 'bcrypt';
import { EmployeeStatus, Prisma, Role } from '@prisma/client';
import { getPagination } from '../common/pagination';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: {
    search?: string;
    status?: EmployeeStatus;
    role?: Role;
    page?: number | string;
    limit?: number | string;
    excludeUserId?: string;
  }) {
    const where: any = {};

    if (query?.excludeUserId) {
      where.id = { not: query.excludeUserId };
    }

    const status = query?.status?.trim();
    if (status && status.toLowerCase() !== 'undefined') {
      const validStatus = Object.values(EmployeeStatus).find((value) => value === status);
      if (!validStatus) {
        throw new BadRequestException(`Invalid employee status '${status}'.`);
      }
      where.status = validStatus;
    }

    const role = query?.role?.trim();
    if (role && role.toLowerCase() !== 'undefined') {
      const validRole = Object.values(Role).find((value) => value === role);
      if (!validRole) {
        throw new BadRequestException(`Invalid employee role '${role}'.`);
      }
      where.role = validRole;
    }

    const search = query?.search?.trim();
    if (search && search.toLowerCase() !== 'undefined') {
      const s = search;
      where.OR = [
        { employeeId: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { department: { contains: s, mode: 'insensitive' } },
      ];
    }

    const total = await this.prisma.user.count({ where });
    const { page, limit, totalPages } = getPagination(query?.page, query?.limit, total);
    const items = await this.prisma.user.findMany({
      where,
      orderBy: { employeeId: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        department: true,
        designation: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { leaveRequests: true },
        },
      },
    });

    return { items, total, page, limit, totalPages };
  }

  async findActiveForDropdown(employeeId?: string) {
    return this.prisma.user.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        ...(employeeId ? { employeeId } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveApprovers() {
    return this.prisma.user.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        role: { in: [Role.HR, Role.DIRECTOR] },
      },
      select: {
        employeeId: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const emp = await this.prisma.user.findUnique({
      where: { id },
      include: {
        leaveRequests: {
          orderBy: { submittedAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async create(dto: CreateEmployeeDto) {
    const trimmedId = dto.employeeId.trim().toUpperCase();
    const trimmedEmail = dto.email.trim().toLowerCase();

    // Check unique employeeId
    const existingId = await this.prisma.user.findUnique({
      where: { employeeId: trimmedId },
    });
    if (existingId) {
      throw new ConflictException(`Employee ID '${trimmedId}' already exists`);
    }

    // Check unique email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existingEmail) {
      throw new ConflictException(`Email '${trimmedEmail}' already registered`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        employeeId: trimmedId,
        name: dto.name.trim(),
        email: trimmedEmail,
        passwordHash,
        role: dto.role || Role.EMPLOYEE,
        status: dto.status || EmployeeStatus.ACTIVE,
        department: dto.department?.trim() || 'General',
        designation: dto.designation?.trim() || 'Team Member',
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        department: true,
        designation: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto, requesterRole: Role) {
    const emp = await this.prisma.user.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (requesterRole === Role.HR && emp.role === Role.DIRECTOR) {
      throw new ForbiddenException('HR users cannot edit Director accounts.');
    }

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.department) data.department = dto.department.trim();
    if (dto.designation) data.designation = dto.designation.trim();
    if (dto.status) data.status = dto.status;

    if (dto.email && dto.email.trim().toLowerCase() !== emp.email) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Email '${email}' is already in use`);
      }
      data.email = email;
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async toggleStatus(id: string) {
    const emp = await this.prisma.user.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');

    // Protect Director from accidental deactivation
    if (emp.role === Role.DIRECTOR && emp.status === EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Primary Director account cannot be deactivated');
    }

    const nextStatus = emp.status === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE;

    return this.prisma.user.update({
      where: { id },
      data: { status: nextStatus },
      select: {
        id: true,
        employeeId: true,
        name: true,
        status: true,
      },
    });
  }

  async remove(id: string, requesterId: string) {
    const employee = await this.prisma.user.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.id === requesterId) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    if (employee.role === Role.DIRECTOR) {
      throw new BadRequestException('Director accounts cannot be deleted from Employee Management.');
    }
    if (employee.status === EmployeeStatus.ACTIVE) {
      throw new BadRequestException(
        'Active employees cannot be deleted. Deactivate the account first.',
      );
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.leaveRequest.deleteMany({
          where: { employeeId: employee.employeeId },
        });
        await transaction.approver.deleteMany({
          where: {
            OR: [
              { approverId: employee.employeeId },
              { email: employee.email },
            ],
          },
        });
        await transaction.user.delete({ where: { id: employee.id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'This account has related records that could not be deleted.',
        );
      }
      throw error;
    }

    return {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
    };
  }
}
