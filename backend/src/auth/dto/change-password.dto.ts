import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Current password is required.' })
  @IsString()
  currentPassword: string;

  @IsNotEmpty({ message: 'New password is required.' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  @Matches(/\S/, { message: 'New password cannot contain only spaces.' })
  newPassword: string;
}
