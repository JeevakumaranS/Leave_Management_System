import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DurationType, LeaveType } from '@prisma/client';

export class CreateLeaveDto {
  @IsNotEmpty({ message: 'Employee ID is mandatory' })
  @IsString()
  employeeId: string;

  @IsNotEmpty({ message: 'Employee Name is mandatory' })
  @IsString()
  employeeName: string;

  @IsNotEmpty({ message: 'Employee Email is mandatory' })
  @IsString()
  employeeEmail: string;

  @IsNotEmpty({ message: 'Manager Email ID is mandatory' })
  @IsString()
  managerEmail: string; // director@durozen.in or hr@durozen.in

  @IsNotEmpty({ message: 'Leave Type is mandatory' })
  @IsEnum(LeaveType, { message: 'Invalid leave type selected' })
  leaveType: LeaveType;

  @IsOptional()
  @IsString()
  otherNote?: string;

  @IsNotEmpty({ message: 'Start Date is mandatory' })
  @IsString()
  startDate: string;

  @IsNotEmpty({ message: 'End Date is mandatory' })
  @IsString()
  endDate: string;

  @IsNotEmpty({ message: 'Duration is mandatory' })
  @IsEnum(DurationType, { message: 'Invalid duration selected' })
  duration: DurationType;

  @IsNotEmpty({ message: 'Reason for Leave cannot be empty' })
  @IsString()
  reason: string;
}
