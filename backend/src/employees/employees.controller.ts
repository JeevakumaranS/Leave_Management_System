import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EmployeeStatus, Role } from '@prisma/client';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // Available for leave application dynamic dropdowns
  @UseGuards(JwtAuthGuard)
  @Get('active')
  async getActiveEmployees(@Request() req: any) {
    const employeeId = req.user.role === Role.EMPLOYEE ? req.user.employeeId : undefined;
    return this.employeesService.findActiveForDropdown(employeeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('approvers')
  async getActiveApprovers() {
    return this.employeesService.findActiveApprovers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(Role.HR, Role.DIRECTOR)
  async getAllEmployees(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('role') role?: Role,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.employeesService.findAll({
      search,
      status,
      role,
      page,
      limit,
      excludeUserId: req.user.id,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(Role.HR, Role.DIRECTOR)
  async getEmployeeById(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.employeesService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(Role.HR, Role.DIRECTOR)
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put(':id')
  @Roles(Role.HR, Role.DIRECTOR)
  async updateEmployee(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Request() req: any,
  ) {
    return this.employeesService.update(id, dto, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/toggle-status')
  @Roles(Role.HR, Role.DIRECTOR)
  async toggleStatus(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.employeesService.toggleStatus(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(Role.HR, Role.DIRECTOR)
  async deleteEmployee(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @Request() req: any,
  ) {
    return this.employeesService.remove(id, req.user.id);
  }
}
