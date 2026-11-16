import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LeaveStatus, LeaveType, Role } from '@prisma/client';

@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // Employee submitting a leave request (SRS 4.1)
  @UseGuards(JwtAuthGuard)
  @Post()
  async submitLeave(@Request() req: any, @Body() dto: CreateLeaveDto) {
    return this.leavesService.create(dto, req.user);
  }

  // Employee viewing their own leave applications & history (SRS 2.1, 7.1)
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyLeaves(@Request() req: any) {
    return this.leavesService.getMyLeaves(req.user.employeeId);
  }

  // Visual leave calendar view (approved leaves)
  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  async getCalendarLeaves(
    @Request() req: any,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.leavesService.getCalendarLeaves(month, year, req.user);
  }

  // HR & Director viewing all employee leave applications (SRS 7.2, 7.3, 8)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('all')
  @Roles(Role.HR, Role.DIRECTOR)
  async getAllLeaves(
    @Query('search') search?: string,
    @Query('status') status?: LeaveStatus,
    @Query('leaveType') leaveType?: LeaveType,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.leavesService.getAll({
      search,
      status,
      leaveType,
      employeeId,
      startDate,
      endDate,
      month,
      year,
      page,
      limit,
    });
  }

  // View specific leave request detail
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getLeaveDetail(@Request() req: any, @Param('id') id: string) {
    const leave = await this.leavesService.getById(id);
    // If regular employee, only allow viewing own leave (SRS 2.1 TC-18)
    if (req.user.role === Role.EMPLOYEE && req.user.employeeId !== leave.employeeId) {
      throw new ForbiddenException('Employees can view only their own leave records.');
    }
    return leave;
  }

  // Cancel pending leave application (SRS 5.3, PD-05)
  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  async cancelLeave(@Request() req: any, @Param('id') id: string) {
    return this.leavesService.cancelLeave(id, req.user);
  }
}
