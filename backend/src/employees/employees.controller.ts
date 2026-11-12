import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
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
  @Get('active')
  async getActiveEmployees() {
    return this.employeesService.findActiveForDropdown();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(Role.HR, Role.DIRECTOR)
  async getAllEmployees(
    @Query('search') search?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('role') role?: Role,
  ) {
    return this.employeesService.findAll({ search, status, role });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(Role.HR, Role.DIRECTOR)
  async getEmployeeById(@Param('id', ParseIntPipe) id: number) {
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/toggle-status')
  @Roles(Role.HR, Role.DIRECTOR)
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.toggleStatus(id);
  }
}
