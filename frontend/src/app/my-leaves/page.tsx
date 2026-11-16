"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { useToast } from "../../components/Toast";
import { Sidebar } from "../../components/Sidebar";
import { Navbar } from "../../components/Navbar";
import { Modal } from "../../components/Modal";
import {
  PAGE_SIZE,
  PaginationControls,
} from "../../components/PaginationControls";
import { formatDate, formatDateTime } from "../../lib/date";
import { useLiveDataRefresh } from "../../lib/use-live-data-refresh";
import {
  FileTextIcon,
  PlusIcon,
  RefreshIcon,
  XIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "../../components/Icons";

export default function MyLeavesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, error } = useToast();

  const [leaves, setLeaves] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      loadMyLeaves();
    }
  }, [user, authLoading]);

  const loadMyLeaves = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.leaves.getMyLeaves();
      setLeaves(data);
    } catch (err: any) {
      if (silent) throw err;
      error(err.message || "Failed to load your leave history");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveDataRefresh(() => loadMyLeaves(true), Boolean(user));

  const handleCancelLeave = async (requestId: string) => {
    if (
      !confirm(
        `Are you sure you want to cancel leave application ${requestId}?`,
      )
    ) {
      return;
    }

    setCancellingId(requestId);
    try {
      await api.leaves.cancel(requestId);
      success(`Leave request ${requestId} cancelled successfully.`);
      if (selectedLeave?.requestId === requestId) {
        setSelectedLeave(null);
      }
      loadMyLeaves();
    } catch (err: any) {
      error(err.message || "Failed to cancel leave request");
    } finally {
      setCancellingId(null);
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (statusFilter === "ALL") return true;
    return l.status === statusFilter;
  });
  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / PAGE_SIZE));
  const paginatedLeaves = filteredLeaves.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar />

        <main className="page-container">
          <div className="page-header">
            <div>
              <h1 className="page-title">My Leave History & Status</h1>
              <p className="page-subtitle">
                Track all submitted leave applications, approvals, and review
                decisions
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => loadMyLeaves()}
                className="btn btn-secondary btn-sm"
                title="Refresh"
              >
                <RefreshIcon size={14} /> Refresh
              </button>
              <Link href="/apply-leave" className="btn btn-primary btn-sm">
                <PlusIcon size={16} /> Apply New Leave
              </Link>
            </div>
          </div>

          {/* Filters Bar */}
          <div
            className="card"
            style={{ padding: "16px 20px", marginBottom: "20px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div
                className="leave-status-filters"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {/* <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Filter by Status:
                </span> */}
                {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStatusFilter(st);
                        setPage(1);
                      }}
                      className="btn btn-sm"
                      style={{
                        backgroundColor:
                          statusFilter === st ? "#15213a" : "#f1f5f9",
                        color: statusFilter === st ? "#ffffff" : "#475569",
                        border: "none",
                      }}
                    >
                      {st}{" "}
                      {st !== "ALL" &&
                        `(${leaves.filter((l) => l.status === st).length})`}
                    </button>
                  ),
                )}
              </div>

              <div style={{ fontSize: "13px", color: "#64748b" }}>
                Showing{" "}
                <strong>
                  {filteredLeaves.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                  -{Math.min(page * PAGE_SIZE, filteredLeaves.length)}
                </strong>{" "}
                of <strong>{filteredLeaves.length}</strong> matching requests
              </div>
            </div>
          </div>

          {/* Leaves Table */}
          {loading ? (
            <div
              className="card"
              style={{ textAlign: "center", padding: "48px" }}
            >
              <div style={{ color: "#64748b" }}>
                Loading your leave applications...
              </div>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: "center", padding: "48px" }}
            >
              <FileTextIcon
                size={36}
                color="#94a3b8"
                style={{ margin: "0 auto 12px", display: "block" }}
              />
              <p style={{ fontWeight: 600, color: "#15213a" }}>
                No leave applications found in this view.
              </p>
              <p
                style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}
              >
                {statusFilter === "ALL"
                  ? "You have not submitted any leave requests yet."
                  : `No requests with status '${statusFilter}'.`}
              </p>
              {statusFilter === "ALL" && (
                <Link
                  href="/apply-leave"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: "16px" }}
                >
                  <PlusIcon size={16} /> Submit Leave Application
                </Link>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Leave Type</th>
                    <th>Dates</th>
                    <th>Duration</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Decision Authority</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeaves.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong style={{ color: "#15213a" }}>
                          {l.requestId}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>
                          {l.leaveType.replace("_", " ")}
                        </span>
                        {l.otherNote && (
                          <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                            Note: {l.otherNote}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "13px" }}>
                          {formatDate(l.startDate)}
                          {l.startDate !== l.endDate
                            ? ` to ${formatDate(l.endDate)}`
                            : ""}
                        </div>
                      </td>
                      <td>
                        {l.numberOfDays} Day{l.numberOfDays > 1 ? "s" : ""} (
                        {l.duration.replace(/_/g, " ")})
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {formatDate(l.submittedAt)}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-${l.status.toLowerCase()}`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td>
                        {l.status === "CANCELLED" ? (
                          <div style={{ fontSize: "12px" }}>
                            <div style={{ fontWeight: 600, color: "#7E8798" }}>
                              Cancelled by Employee
                            </div>
                            {l.decidedAt && (
                              <div
                                style={{ color: "#94A3B8", fontSize: "11px" }}
                              >
                                {formatDateTime(l.decidedAt)}
                              </div>
                            )}
                          </div>
                        ) : l.decidedBy ? (
                          <div style={{ fontSize: "12px" }}>
                            <div style={{ fontWeight: 600 }}>{l.decidedBy}</div>
                            <div style={{ color: "#64748b" }}>
                              {formatDateTime(l.decidedAt)}{" "}
                              {l.decisionMethod ? `(${l.decisionMethod})` : ""}
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#b45309",
                              fontWeight: 500,
                            }}
                          >
                            Awaiting Director/HR
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "6px",
                            justifyContent: "center",
                          }}
                        >
                          {l.status === "PENDING" && (
                            <button
                              onClick={() => handleCancelLeave(l.requestId)}
                              className="btn btn-danger btn-sm"
                              disabled={cancellingId === l.requestId}
                            >
                              {cancellingId === l.requestId
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedLeave(l)}
                            className="btn btn-secondary btn-sm"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredLeaves.length > 0 && (
            <PaginationControls
              currentPage={page}
              totalItems={filteredLeaves.length}
              onPageChange={setPage}
            />
          )}
        </main>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedLeave}
        onClose={() => setSelectedLeave(null)}
        title={`Leave Application Details - ${selectedLeave?.requestId}`}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {selectedLeave?.status === "PENDING" ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleCancelLeave(selectedLeave.requestId)}
                disabled={cancellingId === selectedLeave.requestId}
              >
                Cancel Application
              </button>
            ) : (
              <div />
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedLeave(null)}
            >
              Close
            </button>
          </div>
        }
      >
        {selectedLeave && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
                paddingBottom: "12px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#15213a",
                  }}
                >
                  {selectedLeave.requestId}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Submitted on {formatDateTime(selectedLeave.submittedAt)}
                </div>
              </div>
              <span
                className={`badge badge-${selectedLeave.status.toLowerCase()}`}
                style={{ fontSize: "13px", padding: "6px 12px" }}
              >
                {selectedLeave.status}
              </span>
            </div>

            <table style={{ marginBottom: "16px" }}>
              <tbody>
                <tr>
                  <th style={{ width: "40%" }}>Leave Category</th>
                  <td>
                    {selectedLeave.leaveType.replace("_", " ")}
                    {selectedLeave.otherNote && ` (${selectedLeave.otherNote})`}
                  </td>
                </tr>
                <tr>
                  <th>Requested Duration</th>
                  <td>
                    {selectedLeave.numberOfDays} Day(s) •{" "}
                    {selectedLeave.duration.replace(/_/g, " ")}
                  </td>
                </tr>
                <tr>
                  <th>Start Date / End Date</th>
                  <td>
                    {formatDate(selectedLeave.startDate)} to{" "}
                    {formatDate(selectedLeave.endDate)}
                  </td>
                </tr>
                <tr>
                  <th>Target Manager Approver</th>
                  <td>{selectedLeave.managerEmail}</td>
                </tr>
                <tr>
                  <th>Reason for Leave</th>
                  <td>{selectedLeave.reason}</td>
                </tr>
                {selectedLeave.status === "CANCELLED" ? (
                  <>
                    <tr>
                      <th>Cancellation Detail</th>
                      <td style={{ color: "#7E8798", fontWeight: 600 }}>
                        {selectedLeave.decidedBy || "Cancelled by Employee"}
                      </td>
                    </tr>
                    {selectedLeave.decidedAt && (
                      <tr>
                        <th>Cancellation Time</th>
                        <td>{formatDateTime(selectedLeave.decidedAt)}</td>
                      </tr>
                    )}
                  </>
                ) : selectedLeave.decidedBy ? (
                  <>
                    <tr>
                      <th>Decided By</th>
                      <td>{selectedLeave.decidedBy}</td>
                    </tr>
                    <tr>
                      <th>Decision Timestamp</th>
                      <td>{formatDateTime(selectedLeave.decidedAt)}</td>
                    </tr>
                    {selectedLeave.decisionMethod && (
                      <tr>
                        <th>Decision Method</th>
                        <td>{selectedLeave.decisionMethod}</td>
                      </tr>
                    )}
                  </>
                ) : null}
                {selectedLeave.rejectionRemarks && (
                  <tr>
                    <th>Rejection Remarks</th>
                    <td style={{ color: "#dc2626", fontWeight: 600 }}>
                      {selectedLeave.rejectionRemarks}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
