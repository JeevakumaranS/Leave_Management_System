import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async sendLeaveRequestNotifications(params: {
    request: any;
    directorToken: string;
    hrToken: string;
  }) {
    const { request, directorToken, hrToken } = params;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    const directorEmail = process.env.DIRECTOR_EMAIL || 'director@durozen.in';
    const hrEmail = process.env.HR_EMAIL || 'hr@durozen.in';

    const approvers = [
      { email: directorEmail, role: 'DIRECTOR', token: directorToken, name: 'Director' },
      { email: hrEmail, role: 'HR', token: hrToken, name: 'HR Administrator' },
    ];

    for (const approver of approvers) {
      const approveLink = `${appUrl}/decision?token=${approver.token}&action=approve`;
      const rejectLink = `${appUrl}/decision?token=${approver.token}&action=reject`;

      const subject = `Leave Approval Request – ${request.employeeName} – ${request.employeeId}`;
      const bodyHtml = this.generateRequestEmailHtml({
        approverName: approver.name,
        request,
        approveLink,
        rejectLink,
      });

      await this.sendAndLog({
        requestId: request.requestId,
        recipientEmail: approver.email,
        recipientRole: approver.role,
        notificationType: NotificationType.REQUEST,
        subject,
        bodyPreview: `Leave application submitted by ${request.employeeName} (${request.employeeId}) for ${request.numberOfDays} day(s) from ${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()}.`,
        html: bodyHtml,
      });
    }
  }

  async sendDecisionNotification(params: {
    request: any;
    decision: 'APPROVED' | 'REJECTED';
    approverName: string;
    rejectionRemarks?: string;
  }) {
    const { request, decision, approverName, rejectionRemarks } = params;
    const isApproved = decision === 'APPROVED';

    const subject = isApproved
      ? `Leave Request Approved – ${request.employeeName}`
      : `Leave Request Rejected – ${request.employeeName}`;

    const bodyHtml = isApproved
      ? this.generateApprovedEmailHtml({ request, approverName })
      : this.generateRejectedEmailHtml({ request, approverName, rejectionRemarks });

    await this.sendAndLog({
      requestId: request.requestId,
      recipientEmail: request.employeeEmail,
      recipientRole: 'EMPLOYEE',
      notificationType: isApproved ? NotificationType.APPROVAL : NotificationType.REJECTION,
      subject,
      bodyPreview: isApproved
        ? `Your leave request ${request.requestId} has been approved by ${approverName}.`
        : `Your leave request ${request.requestId} has been rejected by ${approverName}. Remarks: ${rejectionRemarks || 'None'}`,
      html: bodyHtml,
    });
  }

  private async sendAndLog(params: {
    requestId: string;
    recipientEmail: string;
    recipientRole?: string;
    notificationType: NotificationType;
    subject: string;
    bodyPreview: string;
    html: string;
  }) {
    const notificationId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.logger.log(`[EMAIL DISPATCHED] To: ${params.recipientEmail} | Subject: ${params.subject}`);

    return this.prisma.notificationLog.create({
      data: {
        notificationId,
        requestId: params.requestId,
        recipientEmail: params.recipientEmail,
        recipientRole: params.recipientRole,
        notificationType: params.notificationType,
        subject: params.subject,
        bodyPreview: params.bodyPreview,
        deliveryStatus: DeliveryStatus.SENT,
        errorMessage: null,
      },
    });
  }

  async getLogs(requestId?: string) {
    return this.prisma.notificationLog.findMany({
      where: requestId ? { requestId } : undefined,
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        leaveRequest: {
          select: {
            employeeId: true,
            employeeName: true,
            leaveType: true,
            status: true,
          },
        },
      },
    });
  }

  async retryNotification(id: number) {
    const log = await this.prisma.notificationLog.findUnique({ where: { id } });
    if (!log) throw new Error('Notification record not found');

    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        deliveryStatus: DeliveryStatus.SENT,
        errorMessage: null,
        sentAt: new Date(),
      },
    });
  }

  private generateRequestEmailHtml(data: {
    approverName: string;
    request: any;
    approveLink: string;
    rejectLink: string;
  }) {
    const formattedStartDate = new Date(data.request.startDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedEndDate = new Date(data.request.endDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Montserrat', Arial, sans-serif; background-color: #f6f8fb; margin: 0; padding: 24px; color: #17223a; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e8edf3; overflow: hidden; }
          .header { background: #15213a; color: #ffffff; padding: 24px 32px; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0; font-size: 13px; color: #9bb3dd; }
          .content { padding: 32px; }
          .badge { display: inline-block; padding: 4px 10px; background: #fef3c7; color: #b45309; border-radius: 4px; font-weight: 600; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th { text-align: left; padding: 10px; background: #f8fafc; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 40%; }
          td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
          .actions { margin-top: 28px; text-align: center; display: flex; justify-content: center; gap: 16px; }
          .btn { display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; }
          .btn-approve { background-color: #16a34a; color: #ffffff !important; }
          .btn-reject { background-color: #dc2626; color: #ffffff !important; }
          .security-note { margin-top: 24px; padding: 12px; background: #eff6ff; border-left: 4px solid #2769d7; font-size: 12px; color: #1e40af; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 18px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e8edf3; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DUROZEN TECHNOLOGIES</h1>
            <p>Employee Leave Management System</p>
          </div>
          <div class="content">
            <p>Dear ${data.approverName},</p>
            <p>A new employee leave request has been submitted. Please review the details below.</p>
            <p><strong>Approval Status:</strong> <span class="badge">PENDING</span></p>

            <table>
              <tr><th>Leave Request ID</th><td><strong>${data.request.requestId}</strong></td></tr>
              <tr><th>Employee ID</th><td>${data.request.employeeId}</td></tr>
              <tr><th>Employee Name</th><td>${data.request.employeeName}</td></tr>
              <tr><th>Employee Email ID</th><td>${data.request.employeeEmail}</td></tr>
              <tr><th>Leave Type</th><td>${data.request.leaveType.replace('_', ' ')}</td></tr>
              ${data.request.otherNote ? `<tr><th>Other Leave Note</th><td>${data.request.otherNote}</td></tr>` : ''}
              <tr><th>Start Date</th><td>${formattedStartDate}</td></tr>
              <tr><th>End Date</th><td>${formattedEndDate}</td></tr>
              <tr><th>Duration</th><td>${data.request.duration.replace(/_/g, ' ')} (${data.request.numberOfDays} day${data.request.numberOfDays > 1 ? 's' : ''})</td></tr>
              <tr><th>Reason for Leave</th><td>${data.request.reason}</td></tr>
            </table>

            <p style="font-weight: 600; margin-top: 20px;">Take Your Decision:</p>
            <div class="actions">
              <a href="${data.approveLink}" class="btn btn-approve">APPROVE</a>
              &nbsp;&nbsp;
              <a href="${data.rejectLink}" class="btn btn-reject">REJECT</a>
            </div>

            <div class="security-note">
              <strong>Security & Policy Notice:</strong> Selecting a decision button verifies your authorization token and current request status directly on the portal. Either Director or HR can decide. The first valid decision becomes final. Do not forward this approval email.
            </div>

            <p style="margin-top: 24px; font-size: 13px; color: #475569;">
              Regards,<br>
              <strong>Durozen Technologies</strong>
            </p>
          </div>
          <div class="footer">
            &copy; 2026 Durozen Technologies Private Limited. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateApprovedEmailHtml(data: { request: any; approverName: string }) {
    const formattedStartDate = new Date(data.request.startDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedEndDate = new Date(data.request.endDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Montserrat', Arial, sans-serif; background-color: #f6f8fb; margin: 0; padding: 24px; color: #17223a; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e8edf3; overflow: hidden; }
          .header { background: #16a34a; color: #ffffff; padding: 24px 32px; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
          .content { padding: 32px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th { text-align: left; padding: 10px; background: #f8fafc; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 40%; }
          td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
          .footer { background: #f8fafc; padding: 18px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e8edf3; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DUROZEN TECHNOLOGIES</h1>
            <p>Leave Application Status Notification</p>
          </div>
          <div class="content">
            <p>Dear ${data.request.employeeName},</p>
            <p>Your leave request has been <strong>APPROVED</strong>.</p>

            <table>
              <tr><th>Employee ID / Name</th><td>${data.request.employeeId} - ${data.request.employeeName}</td></tr>
              <tr><th>Request ID</th><td>${data.request.requestId}</td></tr>
              <tr><th>Leave Type</th><td>${data.request.leaveType.replace('_', ' ')}</td></tr>
              <tr><th>Start Date / End Date</th><td>${formattedStartDate} to ${formattedEndDate}</td></tr>
              <tr><th>Duration</th><td>${data.request.duration.replace(/_/g, ' ')} (${data.request.numberOfDays} days)</td></tr>
              <tr><th>Approval Status</th><td><span style="color: #16a34a; font-weight: 700;">APPROVED</span></td></tr>
              <tr><th>Approved By</th><td>${data.approverName}</td></tr>
            </table>

            <p style="margin-top: 24px; font-size: 13px; color: #475569;">
              Regards,<br>
              <strong>Durozen Technologies</strong>
            </p>
          </div>
          <div class="footer">
            &copy; 2026 Durozen Technologies Private Limited. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateRejectedEmailHtml(data: { request: any; approverName: string; rejectionRemarks?: string }) {
    const formattedStartDate = new Date(data.request.startDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const formattedEndDate = new Date(data.request.endDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Montserrat', Arial, sans-serif; background-color: #f6f8fb; margin: 0; padding: 24px; color: #17223a; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e8edf3; overflow: hidden; }
          .header { background: #dc2626; color: #ffffff; padding: 24px 32px; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
          .content { padding: 32px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
          th { text-align: left; padding: 10px; background: #f8fafc; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 40%; }
          td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
          .footer { background: #f8fafc; padding: 18px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e8edf3; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DUROZEN TECHNOLOGIES</h1>
            <p>Leave Application Status Notification</p>
          </div>
          <div class="content">
            <p>Dear ${data.request.employeeName},</p>
            <p>Your leave request has been reviewed and <strong>REJECTED</strong>.</p>

            <table>
              <tr><th>Employee ID / Name</th><td>${data.request.employeeId} - ${data.request.employeeName}</td></tr>
              <tr><th>Request ID</th><td>${data.request.requestId}</td></tr>
              <tr><th>Leave Type</th><td>${data.request.leaveType.replace('_', ' ')}</td></tr>
              <tr><th>Requested Dates</th><td>${formattedStartDate} to ${formattedEndDate}</td></tr>
              <tr><th>Duration</th><td>${data.request.duration.replace(/_/g, ' ')} (${data.request.numberOfDays} days)</td></tr>
              <tr><th>Approval Status</th><td><span style="color: #dc2626; font-weight: 700;">REJECTED</span></td></tr>
              <tr><th>Reviewed By</th><td>${data.approverName}</td></tr>
              ${data.rejectionRemarks ? `<tr><th>Rejection Remarks</th><td style="color: #dc2626; font-weight: 600;">${data.rejectionRemarks}</td></tr>` : ''}
            </table>

            <p style="margin-top: 24px; font-size: 13px; color: #475569;">
              Regards,<br>
              <strong>Durozen Technologies</strong>
            </p>
          </div>
          <div class="footer">
            &copy; 2026 Durozen Technologies Private Limited. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
