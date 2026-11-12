import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EmployeeStatus, Role } from '@prisma/client';

export class CreateEmployeeDto {
  @IsNotEmpty({ message: 'Employee ID is mandatory' })
  @IsString()
  employeeId: string;

  @IsNotEmpty({ message: 'Employee Name is mandatory' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Employee Email ID is mandatory' })
  @IsEmail({}, { message: 'Employee Email ID must be a valid email' })
  email: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;
}
