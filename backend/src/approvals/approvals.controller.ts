import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { DecideWithTokenDto, DecidePortalDto } from './dto/decision.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  // Verification endpoint for email token links (SRS 6.2, 6.3, 12)
  @Get('verify-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.DIRECTOR)
  async verifyToken(@Request() req: any, @Query('token') token: string) {
    return this.approvalsService.verifyToken(token, req.user);
  }

  // Email-based decision submission
  @Post('decide-with-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HR, Role.DIRECTOR)
  async decideWithToken(@Request() req: any, @Body() dto: DecideWithTokenDto) {
    return this.approvalsService.decideWithToken(dto, req.user);
  }

  // In-portal decision submission (HR/Director only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('portal-decide/:requestId')
  @Roles(Role.HR, Role.DIRECTOR)
  async decidePortal(
    @Request() req: any,
    @Param('requestId') requestId: string,
    @Body() dto: DecidePortalDto,
  ) {
    return this.approvalsService.decidePortal(requestId, dto, req.user);
  }
}
