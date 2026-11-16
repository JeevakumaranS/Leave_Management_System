import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { IsReasonText } from '../../common/reason-text';

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

  @ValidateIf((dto: DecideWithTokenDto) => dto.action === ApprovalAction.REJECT)
  @IsReasonText('Rejection remarks')
  rejectionRemarks?: string;
}

export class DecidePortalDto {
  @IsNotEmpty({ message: 'Decision action is required' })
  @IsEnum(ApprovalAction)
  action: ApprovalAction;

  @ValidateIf((dto: DecidePortalDto) => dto.action === ApprovalAction.REJECT)
  @IsReasonText('Rejection remarks')
  rejectionRemarks?: string;
}
