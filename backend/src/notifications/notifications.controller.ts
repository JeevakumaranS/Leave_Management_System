import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(Role.HR, Role.DIRECTOR)
  async getLogs(
    @Query('requestId') requestId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getLogs(requestId, page, limit);
  }

  @Post(':id/retry')
  @Roles(Role.HR, Role.DIRECTOR)
  async retryNotification(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ) {
    return this.notificationsService.retryNotification(id);
  }
}
