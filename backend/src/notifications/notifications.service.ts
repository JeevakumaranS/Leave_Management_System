import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DeliveryStatus, NotificationType, Role } from "@prisma/client";
import { getPagination } from "../common/pagination";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

function formatDDMMYYYY(val: string | Date | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly appScriptEnabled: boolean;
  private readonly appScriptUrl?: string;
  private readonly appScriptSecret?: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const enabledValue = (
      this.config.get<string>("APPSCRIPT_ENABLED") ?? "false"
    )
      .trim()
      .toLowerCase();
    if (enabledValue !== "true" && enabledValue !== "false") {
      throw new Error("APPSCRIPT_ENABLED must be either true or false.");
    }

    this.appScriptEnabled = enabledValue === "true";
    if (this.appScriptEnabled) {
      const urlValue = this.config.get<string>("APPSCRIPT_WEB_APP_URL")?.trim();
      const secretValue = this.config
        .get<string>("APPSCRIPT_SHARED_SECRET")
        ?.trim();

      if (!urlValue)
        throw new Error(
          "APPSCRIPT_WEB_APP_URL is required when Apps Script email is enabled.",
        );
      if (!secretValue || secretValue.length < 32) {
        throw new Error(
          "APPSCRIPT_SHARED_SECRET must contain at least 32 characters when Apps Script email is enabled.",
        );
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(urlValue);
      } catch {
        throw new Error(
          "APPSCRIPT_WEB_APP_URL must be a valid Google Apps Script Web App URL.",
        );
      }
      if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== "script.google.com" ||
        !parsedUrl.pathname.endsWith("/exec")
      ) {
        throw new Error(
          "APPSCRIPT_WEB_APP_URL must be an HTTPS Google Apps Script /exec URL.",
        );
      }

      this.appScriptUrl = urlValue;
      this.appScriptSecret = secretValue;
    }
  }

  async sendLeaveRequestNotifications(params: {
    request: any;
    approvers: Array<{
      employeeId: string;
      name: string;
      email: string;
      role: Role;
      token: string;
    }>;
  }) {
    const { request, approvers } = params;
    const appUrl = this.config
      .getOrThrow<string>("APP_URL")
      .replace(/\/+$/, "");

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
        bodyPreview: `Leave application submitted by ${request.employeeName} (${request.employeeId}) for ${request.numberOfDays} day(s) from ${formatDDMMYYYY(request.startDate)} to ${formatDDMMYYYY(request.endDate)}.`,
        html: bodyHtml,
      });
    }
  }

  async sendDecisionNotification(params: {
    request: any;
    decision: "APPROVED" | "REJECTED";
    approverName: string;
    rejectionRemarks?: string;
  }) {
    const { request, decision, approverName, rejectionRemarks } = params;
    const isApproved = decision === "APPROVED";

    const subject = isApproved
      ? `Leave Request Approved – ${request.employeeName}`
      : `Leave Request Rejected – ${request.employeeName}`;

    const bodyHtml = isApproved
      ? this.generateApprovedEmailHtml({ request, approverName })
      : this.generateRejectedEmailHtml({
          request,
          approverName,
          rejectionRemarks,
        });

    await this.sendAndLog({
      requestId: request.requestId,
      recipientEmail: request.employeeEmail,
      recipientRole: "EMPLOYEE",
      notificationType: isApproved
        ? NotificationType.APPROVAL
        : NotificationType.REJECTION,
      subject,
      bodyPreview: isApproved
        ? `Your leave request ${request.requestId} has been approved by ${approverName}.`
        : `Your leave request ${request.requestId} has been rejected by ${approverName}. Remarks: ${rejectionRemarks || "None"}`,
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
    let deliveryStatus: DeliveryStatus = DeliveryStatus.SENT;
    let errorMessage: string | null = null;

    try {
      await this.deliverEmail({
        to: params.recipientEmail,
        subject: params.subject,
        textBody: params.bodyPreview,
        htmlBody: params.html,
      });
      this.logger.log(
        `Email delivered to ${params.recipientEmail} | Subject: ${params.subject}`,
      );
    } catch (error) {
      deliveryStatus = DeliveryStatus.FAILED;
      errorMessage = this.getDeliveryErrorMessage(error);
      this.logger.error(
        `Email delivery failed for ${params.recipientEmail}: ${errorMessage}`,
      );
    }

    return this.prisma.notificationLog.create({
      data: {
        notificationId,
        requestId: params.requestId,
        recipientEmail: params.recipientEmail,
        recipientRole: params.recipientRole,
        notificationType: params.notificationType,
        subject: params.subject,
        bodyPreview: params.bodyPreview,
        deliveryStatus,
        errorMessage,
      },
    });
  }

  async getLogs(
    requestId?: string,
    pageValue?: number | string,
    limitValue?: number | string,
  ) {
    const where = requestId ? { requestId } : undefined;
    const total = await this.prisma.notificationLog.count({ where });
    const { page, limit, totalPages } = getPagination(
      pageValue,
      limitValue,
      total,
    );
    const items = await this.prisma.notificationLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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

    return { items, total, page, limit, totalPages };
  }

  async retryNotification(id: string) {
    const log = await this.prisma.notificationLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException("Notification record not found");

    let deliveryStatus: DeliveryStatus = DeliveryStatus.SENT;
    let errorMessage: string | null = null;
    try {
      await this.deliverEmail({
        to: log.recipientEmail,
        subject: log.subject,
        textBody: log.bodyPreview || log.subject,
      });
      this.logger.log(
        `Email retry delivered to ${log.recipientEmail} | Subject: ${log.subject}`,
      );
    } catch (error) {
      deliveryStatus = DeliveryStatus.FAILED;
      errorMessage = this.getDeliveryErrorMessage(error);
      this.logger.error(
        `Email retry failed for ${log.recipientEmail}: ${errorMessage}`,
      );
    }

    return this.prisma.notificationLog.update({
      where: { id },
      data: {
        deliveryStatus,
        errorMessage,
        sentAt: new Date(),
      },
    });
  }

  private async deliverEmail(params: {
    to: string;
    subject: string;
    textBody: string;
    htmlBody?: string;
  }) {
    if (!this.appScriptEnabled || !this.appScriptUrl || !this.appScriptSecret) {
      throw new Error(
        "Apps Script email delivery is disabled (APPSCRIPT_ENABLED=false).",
      );
    }

    const response = await axios.post<unknown>(
      this.appScriptUrl,
      { ...params, secret: this.appScriptSecret },
      { timeout: 30000, maxRedirects: 5 },
    );

    if (
      !response.data ||
      typeof response.data !== "object" ||
      !("ok" in response.data) ||
      response.data.ok !== true
    ) {
      const responseError =
        response.data &&
        typeof response.data === "object" &&
        "error" in response.data &&
        typeof response.data.error === "string"
          ? response.data.error
          : "Apps Script returned an invalid response.";
      throw new Error(responseError);
    }
  }

  private getDeliveryErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      if (error.response)
        return `Apps Script returned HTTP ${error.response.status}.`;
      return `Apps Script request failed: ${error.message}`;
    }
    return error instanceof Error
      ? error.message
      : "Unknown email delivery error.";
  }

  private getLogoImgTag(): string {
    // Single straight row text branding - 100% reliable across all email clients with no images
    return `<div style="font-size: 18px; font-weight: 800; color: #17223a; letter-spacing: 0.6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-transform: uppercase; white-space: nowrap; line-height: 1.2;">DUROZEN TECHNOLOGIES</div>`;
  }

  private generateRequestEmailHtml(data: {
    approverName: string;
    request: any;
    approveLink: string;
    rejectLink: string;
  }) {
    const formattedStartDate = formatDDMMYYYY(data.request.startDate);
    const formattedEndDate = formatDDMMYYYY(data.request.endDate);
    const logoTag = this.getLogoImgTag();
    const durationLabel = data.request.duration ? data.request.duration.replace(/_/g, ' ') : 'FULL DAY';
    const leaveTypeLabel = data.request.leaveType ? data.request.leaveType.replace(/_/g, ' ') : 'LEAVE';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Approval Request</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 28px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                <!-- Header with Logo and Brand -->
                <tr>
                  <td style="background-color: #ffffff; padding: 22px 32px; border-bottom: 2px solid #2769d7;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="left" style="vertical-align: middle;">
                          ${logoTag}
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 11px; font-weight: 700; color: #2769d7; letter-spacing: 1px; text-transform: uppercase;">Leave Management</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Status Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #15213a 0%, #1e293b 100%); padding: 18px 32px; color: #ffffff;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <span style="display: inline-block; padding: 4px 10px; background-color: #fef3c7; color: #b45309; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">Action Required</span>
                          <h2 style="margin: 8px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: 0.2px;">Leave Approval Request</h2>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 12px; color: #94a3b8; font-family: monospace;">${data.request.requestId}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 28px 32px 32px 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">
                      Dear <strong>${data.approverName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                      A leave application has been submitted by <strong>${data.request.employeeName}</strong> (<span style="font-family: monospace; color: #0f172a; font-weight: 600;">${data.request.employeeId}</span>) and is awaiting your review.
                    </p>

                    <!-- Details Card -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; font-size: 13.5px; border-collapse: separate;">
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; width: 38%;">Leave Request ID</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700; font-family: monospace;">${data.request.requestId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Employee Name & ID</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${data.request.employeeName} (${data.request.employeeId})</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Employee Email</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${data.request.employeeEmail || '-'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Leave Type</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #2769d7;">${leaveTypeLabel}</td>
                      </tr>
                      ${data.request.otherNote ? `
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Other Leave Note</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${data.request.otherNote}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Leave Period (DD/MM/YYYY)</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${formattedStartDate} to ${formattedEndDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Duration</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${data.request.numberOfDays} Day${data.request.numberOfDays > 1 ? 's' : ''} (${durationLabel})</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; color: #64748b; font-weight: 600; vertical-align: top;">Reason for Leave</td>
                        <td style="padding: 12px 16px; color: #0f172a; line-height: 1.5; background-color: #ffffff; border-radius: 0 0 6px 0;">
                          <div style="padding: 8px 12px; background-color: #f1f5f9; border-left: 3px solid #2769d7; border-radius: 4px; font-style: italic; color: #334155;">
                            "${data.request.reason || 'No specific reason provided'}"
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Decision Action Buttons -->
                    <div style="margin: 28px 0; text-align: center;">
                      <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
                        Select Your Decision
                      </p>
                      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                        <tr>
                          <td align="center" style="padding: 0 8px;">
                            <a href="${data.approveLink}" style="display: inline-block; background-color: #16a34a; color: #ffffff !important; text-decoration: none; padding: 13px 32px; font-size: 14px; font-weight: 700; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(22, 163, 74, 0.35);">
                              &#10003;&nbsp; APPROVE LEAVE
                            </a>
                          </td>
                          <td align="center" style="padding: 0 8px;">
                            <a href="${data.rejectLink}" style="display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 13px 32px; font-size: 14px; font-weight: 700; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.35);">
                              &#10007;&nbsp; REJECT LEAVE
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <!-- Policy & Dual Approver Information Box -->
                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 6px; padding: 14px 16px; margin-top: 24px; font-size: 12px; color: #1e40af; line-height: 1.55;">
                      <strong>Dual-Authority Workflow:</strong> Both the Director and HR Administrator receive this notification. The first authorized decision recorded in the portal becomes final. The approval link will authenticate your role before confirmation. Do not forward this email.
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      &copy; 2026 Durozen Technologies Private Limited. All rights reserved.
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                      This is an automated system notification from the Durozen Leave Management Portal.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private generateApprovedEmailHtml(data: {
    request: any;
    approverName: string;
  }) {
    const formattedStartDate = formatDDMMYYYY(data.request.startDate);
    const formattedEndDate = formatDDMMYYYY(data.request.endDate);
    const logoTag = this.getLogoImgTag();
    const durationLabel = data.request.duration ? data.request.duration.replace(/_/g, ' ') : 'FULL DAY';
    const leaveTypeLabel = data.request.leaveType ? data.request.leaveType.replace(/_/g, ' ') : 'LEAVE';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request Approved</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 28px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                <!-- Header with Logo -->
                <tr>
                  <td style="background-color: #ffffff; padding: 22px 32px; border-bottom: 2px solid #16a34a;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="left" style="vertical-align: middle;">
                          ${logoTag}
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 11px; font-weight: 700; color: #16a34a; letter-spacing: 1px; text-transform: uppercase;">Status Update</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Status Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #15803d 0%, #166534 100%); padding: 18px 32px; color: #ffffff;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <span style="display: inline-block; padding: 4px 10px; background-color: #dcfce7; color: #166534; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">&#10003; Approved</span>
                          <h2 style="margin: 8px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">Leave Request Approved</h2>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 12px; color: #bbf7d0; font-family: monospace;">${data.request.requestId}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 28px 32px 32px 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">
                      Dear <strong>${data.request.employeeName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                      Good news! Your leave application (<span style="font-family: monospace; font-weight: 600;">${data.request.requestId}</span>) has been reviewed and <strong>APPROVED</strong>.
                    </p>

                    <!-- Details Card -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; font-size: 13.5px; border-collapse: separate;">
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; width: 38%;">Leave Request ID</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700; font-family: monospace;">${data.request.requestId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Leave Type</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${leaveTypeLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Approved Period (DD/MM/YYYY)</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: 700;">${formattedStartDate} to ${formattedEndDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Duration</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${data.request.numberOfDays} Day${data.request.numberOfDays > 1 ? 's' : ''} (${durationLabel})</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Approved By</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${data.approverName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; color: #64748b; font-weight: 600;">Status</td>
                        <td style="padding: 12px 16px; color: #16a34a; font-weight: 800;">APPROVED</td>
                      </tr>
                    </table>

                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                      Your leave records and balance have been updated automatically in the Durozen Leave Management System.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      &copy; 2026 Durozen Technologies Private Limited. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private generateRejectedEmailHtml(data: {
    request: any;
    approverName: string;
    rejectionRemarks?: string;
  }) {
    const formattedStartDate = formatDDMMYYYY(data.request.startDate);
    const formattedEndDate = formatDDMMYYYY(data.request.endDate);
    const logoTag = this.getLogoImgTag();
    const durationLabel = data.request.duration ? data.request.duration.replace(/_/g, ' ') : 'FULL DAY';
    const leaveTypeLabel = data.request.leaveType ? data.request.leaveType.replace(/_/g, ' ') : 'LEAVE';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request Declined</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 28px 12px; color: #1e293b; -webkit-font-smoothing: antialiased;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                <!-- Header with Logo -->
                <tr>
                  <td style="background-color: #ffffff; padding: 22px 32px; border-bottom: 2px solid #dc2626;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="left" style="vertical-align: middle;">
                          ${logoTag}
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 11px; font-weight: 700; color: #dc2626; letter-spacing: 1px; text-transform: uppercase;">Status Update</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Status Banner -->
                <tr>
                  <td style="background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); padding: 18px 32px; color: #ffffff;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td>
                          <span style="display: inline-block; padding: 4px 10px; background-color: #fee2e2; color: #991b1b; border-radius: 9999px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">Decision Notice</span>
                          <h2 style="margin: 8px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">Leave Request Declined</h2>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                          <div style="font-size: 12px; color: #fecaca; font-family: monospace;">${data.request.requestId}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 28px 32px 32px 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">
                      Dear <strong>${data.request.employeeName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                      This notification is to inform you that your leave request (<span style="font-family: monospace; font-weight: 600;">${data.request.requestId}</span>) has been reviewed and was <strong>DECLINED</strong>.
                    </p>

                    <!-- Details Card -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; font-size: 13.5px; border-collapse: separate;">
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; width: 38%;">Leave Request ID</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700; font-family: monospace;">${data.request.requestId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Leave Type</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${leaveTypeLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Requested Period (DD/MM/YYYY)</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${formattedStartDate} to ${formattedEndDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Duration</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${data.request.numberOfDays} Day${data.request.numberOfDays > 1 ? 's' : ''} (${durationLabel})</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Reviewed By</td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${data.approverName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; ${data.rejectionRemarks ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #64748b; font-weight: 600;">Decision</td>
                        <td style="padding: 12px 16px; ${data.rejectionRemarks ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #dc2626; font-weight: 800;">REJECTED</td>
                      </tr>
                      ${data.rejectionRemarks ? `
                      <tr>
                        <td style="padding: 12px 16px; color: #64748b; font-weight: 600; vertical-align: top;">Rejection Remarks</td>
                        <td style="padding: 12px 16px; color: #dc2626; font-weight: 600; background-color: #fef2f2; border-radius: 0 0 6px 0;">
                          ${data.rejectionRemarks}
                        </td>
                      </tr>` : ''}
                    </table>

                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                      If you have questions or require further clarification, please connect directly with your reporting authority or HR department.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      &copy; 2026 Durozen Technologies Private Limited. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
