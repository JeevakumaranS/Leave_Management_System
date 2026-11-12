import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Employee ID or Email is required' })
  @IsString()
  identifier: string; // Accepts Employee ID (e.g. EMP-101) or Email (e.g. sarah@durozen.in)

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}

export class QuickLoginDto {
  @IsNotEmpty()
  @IsString()
  role: 'EMPLOYEE' | 'HR' | 'DIRECTOR';
}
