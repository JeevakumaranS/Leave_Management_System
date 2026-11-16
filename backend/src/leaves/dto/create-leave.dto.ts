import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { DurationType, LeaveType } from '@prisma/client';
import { IsReasonText } from '../../common/reason-text';

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
  managerEmail: string;

  @IsNotEmpty({ message: 'Leave Type is mandatory' })
  @IsEnum(LeaveType, { message: 'Invalid leave type selected' })
  leaveType: LeaveType;

  @ValidateIf((dto: CreateLeaveDto) => dto.leaveType === LeaveType.OTHER || dto.otherNote !== undefined)
  @IsReasonText('Other Leave Note')
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

  @IsReasonText('Reason for Leave')
  reason: string;
}
