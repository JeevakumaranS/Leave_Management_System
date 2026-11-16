import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string) {
    const trimmed = identifier.trim();
    // Search by email or employeeId
    const employee = await this.prisma.user.findFirst({
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('User account not found.');
    }

    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully.' };
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
      },
    };
  }

  async getProfile(userId: string) {
    const employee = await this.prisma.user.findUnique({
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
        createdAt: true,
      },
    });

    if (!employee) {
      throw new UnauthorizedException('User profile not found');
    }

    return employee;
  }
}
