import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string) {
    const trimmed = identifier.trim();
    // Search by email or employeeId
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          { employeeId: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials: user not found');
    }

    if (employee.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is deactivated. Please contact HR or Director.');
    }

    const isMatch = await bcrypt.compare(pass, employee.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials: password incorrect');
    }

    return employee;
  }

  async login(loginDto: LoginDto) {
    const employee = await this.validateUser(loginDto.identifier, loginDto.password);
    return this.generateTokenResponse(employee);
  }

  async quickLogin(role: 'EMPLOYEE' | 'HR' | 'DIRECTOR') {
    let email = '';
    if (role === 'DIRECTOR') {
      email = 'director@durozen.in';
    } else if (role === 'HR') {
      email = 'hr@durozen.in';
    } else {
      email = 'sarah.jenkins@durozen.in';
    }

    const employee = await this.prisma.employee.findFirst({
      where: { email },
    });

    if (!employee) {
      throw new BadRequestException(`Default ${role} account not found in database`);
    }

    return this.generateTokenResponse(employee);
  }

  private generateTokenResponse(employee: any) {
    const payload = {
      sub: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        designation: employee.designation,
        status: employee.status,
        annualQuota: employee.annualQuota,
        usedQuota: employee.usedQuota,
        remainingQuota: Math.max(0, employee.annualQuota - employee.usedQuota),
      },
    };
  }

  async getProfile(userId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: userId },
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
      },
    });

    if (!employee) {
      throw new UnauthorizedException('User profile not found');
    }

    return {
      ...employee,
      remainingQuota: Math.max(0, employee.annualQuota - employee.usedQuota),
    };
  }
}
