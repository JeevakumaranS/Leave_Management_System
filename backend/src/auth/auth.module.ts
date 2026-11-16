import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresInMinutes = Number(
          config.getOrThrow<string>('JWT_EXPIRES_IN_MINUTES'),
        );
        if (
          !Number.isSafeInteger(expiresInMinutes) ||
          expiresInMinutes <= 0 ||
          !Number.isSafeInteger(expiresInMinutes * 60)
        ) {
          throw new Error(
            'JWT_EXPIRES_IN_MINUTES must be a positive integer',
          );
        }

        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn: expiresInMinutes * 60 },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
