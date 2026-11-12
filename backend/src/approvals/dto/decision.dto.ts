import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class DecideWithTokenDto {
  @IsNotEmpty({ message: 'Token is required' })
  @IsString()
  token: string;

  @IsNotEmpty({ message: 'Decision action is required' })
  @IsEnum(ApprovalAction)
  action: ApprovalAction;

  @IsOptional()
  @IsString()
  approverEmailConfirmation?: string;

  @IsOptional()
  @IsString()
  rejectionRemarks?: string;
}

export class DecidePortalDto {
  @IsNotEmpty({ message: 'Decision action is required' })
  @IsEnum(ApprovalAction)
  action: ApprovalAction;

  @IsOptional()
  @IsString()
  rejectionRemarks?: string;
}
