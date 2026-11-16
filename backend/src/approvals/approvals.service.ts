import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalAction, DecideWithTokenDto, DecidePortalDto } from './dto/decision.dto';
import { DecisionMethod, LeaveStatus, Role, TokenStatus } from '@prisma/client';

function formatDDMMYYYYTime(val: Date | null | undefined): string {
  if (!val) return '';
  const day = String(val.getDate()).padStart(2, '0');
  const month = String(val.getMonth() + 1).padStart(2, '0');
  const year = val.getFullYear();
  const hours = String(val.getHours()).padStart(2, '0');
  const minutes = String(val.getMinutes()).padStart(2, '0');
  const seconds = String(val.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async verifyToken(token: string, currentUser: any) {
    if (!token) throw new BadRequestException('Verification token is required');

    const tokenRecord = await this.prisma.approvalToken.findUnique({
      where: { tokenHash: token },
      include: {
        leaveRequest: true,
      },
    });

    if (!tokenRecord) {
      throw new NotFoundException('Invalid or unknown approval token.');
    }
    this.assertTokenApprover(tokenRecord.approverId, currentUser);

    const isExpired = new Date() > tokenRecord.expiresAt;
    const isPending = tokenRecord.leaveRequest.status === LeaveStatus.PENDING;

    return {
      tokenId: tokenRecord.tokenId,
      approverEmail: tokenRecord.approverEmail,
      approverId: tokenRecord.approverId,
      tokenStatus: tokenRecord.status,
      isExpired,
      isPending,
      request: tokenRecord.leaveRequest,
      alreadyDecidedBy: tokenRecord.leaveRequest.decidedBy,
      decidedAt: tokenRecord.leaveRequest.decidedAt,
      decisionStatus: tokenRecord.leaveRequest.status,
    };
  }

  async decideWithToken(dto: DecideWithTokenDto, currentUser: any) {
    const tokenRecord = await this.prisma.approvalToken.findUnique({
      where: { tokenHash: dto.token },
      include: { leaveRequest: true },
    });

    if (!tokenRecord) {
      throw new NotFoundException('Invalid decision token.');
    }
    this.assertTokenApprover(tokenRecord.approverId, currentUser);

    if (tokenRecord.status !== TokenStatus.ACTIVE) {
      throw new BadRequestException(
        `This decision token has already been ${tokenRecord.status.toLowerCase()}. It cannot be reused.`,
      );
    }

    if (new Date() > tokenRecord.expiresAt) {
      await this.prisma.approvalToken.update({
        where: { id: tokenRecord.id },
        data: { status: TokenStatus.EXPIRED },
      });
      throw new BadRequestException('Decision token has expired.');
    }

    // Atomic transaction ensuring race-condition safety between Director and HR (BR-11, BR-12)
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-fetch leave request with row check
      const currentLeave = await tx.leaveRequest.findUnique({
        where: { requestId: tokenRecord.requestId },
      });

      if (!currentLeave) {
        throw new NotFoundException('Associated leave request not found.');
      }

      if (currentLeave.status !== LeaveStatus.PENDING) {
        // Another approver already decided!
        throw new ConflictException(
          `Decision conflict: Request ${currentLeave.requestId} was already decided as '${currentLeave.status}' by ${currentLeave.decidedBy || 'another approver'} on ${formatDDMMYYYYTime(currentLeave.decidedAt)}. Further actions are rejected.`,
        );
      }

      const isApprove = dto.action === ApprovalAction.APPROVE;
      const finalStatus = isApprove ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;

      const approverName =
        currentUser.role === Role.DIRECTOR ? 'Director' : 'HR Administrator';

      // 1. Mark this token as USED
      await tx.approvalToken.update({
        where: { id: tokenRecord.id },
        data: {
          status: TokenStatus.USED,
          usedAt: new Date(),
        },
      });

      // 2. Invalidate all other tokens for this request (BR-11, TC-13)
      await tx.approvalToken.updateMany({
        where: {
          requestId: tokenRecord.requestId,
          id: { not: tokenRecord.id },
        },
        data: {
          status: TokenStatus.REVOKED,
        },
      });

      // 3. Update the leave request atomically
      const updatedLeave = await tx.leaveRequest.update({
        where: { requestId: tokenRecord.requestId },
        data: {
          status: finalStatus,
          decidedBy: `${approverName} (${currentUser.email})`,
          decidedByEmail: currentUser.email,
          decidedAt: new Date(),
          decisionMethod: DecisionMethod.EMAIL,
          rejectionRemarks: !isApprove ? dto.rejectionRemarks?.trim() || 'Not specified' : null,
        },
      });

      return { updatedLeave, approverName };
    });

    // 5. Send automated confirmation notification to employee (SRS 6.4, 6.5, BR-13)
    this.notificationsService
      .sendDecisionNotification({
        request: result.updatedLeave,
        decision: result.updatedLeave.status as any,
        approverName: result.approverName,
        rejectionRemarks: result.updatedLeave.rejectionRemarks || undefined,
      })
      .catch((err) => console.error('Error sending decision notification:', err));

    return result.updatedLeave;
  }

  async decidePortal(requestId: string, dto: DecidePortalDto, currentUser: any) {
    if (currentUser.role !== 'HR' && currentUser.role !== 'DIRECTOR') {
      throw new ForbiddenException('Only HR and Director can decide leave requests.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const currentLeave = await tx.leaveRequest.findUnique({
        where: { requestId },
      });

      if (!currentLeave) {
        throw new NotFoundException('Leave request not found.');
      }

      if (currentLeave.status !== LeaveStatus.PENDING) {
        throw new ConflictException(
          `Request ${currentLeave.requestId} has already been marked as ${currentLeave.status} by ${currentLeave.decidedBy || 'approver'}.`,
        );
      }

      const isApprove = dto.action === ApprovalAction.APPROVE;
      const finalStatus = isApprove ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;

      // Invalidate all tokens since decision was made in portal
      await tx.approvalToken.updateMany({
        where: { requestId },
        data: { status: TokenStatus.REVOKED },
      });

      const approverDisplayName = `${currentUser.name} (${currentUser.role})`;

      const updatedLeave = await tx.leaveRequest.update({
        where: { requestId },
        data: {
          status: finalStatus,
          decidedBy: approverDisplayName,
          decidedByEmail: currentUser.email,
          decidedAt: new Date(),
          decisionMethod: DecisionMethod.PORTAL,
          rejectionRemarks: !isApprove ? dto.rejectionRemarks?.trim() || 'Declined by Administrator' : null,
        },
      });

      return { updatedLeave, approverDisplayName };
    });

    this.notificationsService
      .sendDecisionNotification({
        request: result.updatedLeave,
        decision: result.updatedLeave.status as any,
        approverName: result.approverDisplayName,
        rejectionRemarks: result.updatedLeave.rejectionRemarks || undefined,
      })
      .catch((err) => console.error('Error sending portal decision notification:', err));

    return result.updatedLeave;
  }

  private assertTokenApprover(approverId: string, currentUser: any) {
    if (approverId !== currentUser.employeeId) {
      throw new ForbiddenException(
        'This approval link is assigned to another account. Sign in with the authorized approver account.',
      );
    }
  }
}
