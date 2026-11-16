import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Employee ID or Email is required' })
  @IsString()
  identifier: string; // Accepts an Employee ID or email address.

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}
