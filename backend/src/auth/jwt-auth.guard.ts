import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization token format');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      if (typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid authentication token subject');
      }

      const employee = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!employee || employee.status !== 'ACTIVE') {
        throw new UnauthorizedException('User account is inactive or not found');
      }

      request.user = {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        status: employee.status,
        department: employee.department,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
