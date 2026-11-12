import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import * as bcrypt from 'bcrypt';
import { EmployeeStatus, Role } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { search?: string; status?: EmployeeStatus; role?: Role }) {
    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.role) {
      where.role = query.role;
    }

    if (query?.search) {
      const s = query.search.trim();
      where.OR = [
        { employeeId: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { department: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.employee.findMany({
      where,
      orderBy: { employeeId: 'asc' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        department: true,
        designation: true,
        annualQuota: true,
        usedQuota: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { leaveRequests: true },
        },
      },
    });
  }

  async findActiveForDropdown() {
    return this.prisma.employee.findMany({
      where: { status: EmployeeStatus.ACTIVE },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        role: true,
        department: true,
        designation: true,
        annualQuota: true,
        usedQuota: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number) {
    const emp = await this.prisma.employee.findUnique({
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
    const existingId = await this.prisma.employee.findUnique({
      where: { employeeId: trimmedId },
    });
    if (existingId) {
      throw new ConflictException(`Employee ID '${trimmedId}' already exists`);
    }

    // Check unique email
    const existingEmail = await this.prisma.employee.findUnique({
      where: { email: trimmedEmail },
    });
    if (existingEmail) {
      throw new ConflictException(`Email '${trimmedEmail}' already registered`);
    }

    const defaultPassword = dto.password || 'Password@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    return this.prisma.employee.create({
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

  async update(id: number, dto: UpdateEmployeeDto) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');

    const data: any = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.department) data.department = dto.department.trim();
    if (dto.designation) data.designation = dto.designation.trim();
    if (dto.status) data.status = dto.status;

    if (dto.email && dto.email.trim().toLowerCase() !== emp.email) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.employee.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Email '${email}' is already in use`);
      }
      data.email = email;
    }

    return this.prisma.employee.update({
      where: { id },
      data,
    });
  }

  async toggleStatus(id: number) {
    const emp = await this.prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');

    // Protect Director from accidental deactivation
    if (emp.role === Role.DIRECTOR && emp.status === EmployeeStatus.ACTIVE) {
      throw new BadRequestException('Primary Director account cannot be deactivated');
    }

    const nextStatus = emp.status === EmployeeStatus.ACTIVE ? EmployeeStatus.INACTIVE : EmployeeStatus.ACTIVE;

    return this.prisma.employee.update({
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
}
