import { Controller, Get, Query, Res, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LeaveStatus, Role } from '@prisma/client';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('dashboard-stats')
  @Roles(Role.HR, Role.DIRECTOR)
  async getAdminStats() {
    return this.reportsService.getAdminDashboardStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('employee-dashboard-stats')
  async getEmployeeStats(@Request() req: any) {
    return this.reportsService.getEmployeeDashboardStats(req.user.employeeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('analytics')
  @Roles(Role.HR, Role.DIRECTOR)
  async getAnalytics() {
    return this.reportsService.getLeaveAnalytics();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('export-csv')
  @Roles(Role.HR, Role.DIRECTOR)
  async exportCsv(
    @Res() res: Response,
    @Query('status') status?: LeaveStatus,
    @Query('year') year?: number,
  ) {
    const csvString = await this.reportsService.generateCsvData({ status, year });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=durozen_leave_report_${Date.now()}.csv`);
    return res.status(200).send(csvString);
  }
}
