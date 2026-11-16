"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../components/Toast";
import { EyeIcon, EyeOffIcon } from "../../components/Icons";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { success, error } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPostLoginRoute = () => {
    const returnTo = new URLSearchParams(window.location.search).get(
      "returnTo",
    );
    return returnTo?.startsWith("/decision?") ? returnTo : "/dashboard";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      error("Please enter your Employee ID / Email and password");
      return;
    }

    setLoading(true);
    try {
      await login(identifier, password);
      success("Logged in successfully");
      router.replace(getPostLoginRoute());
    } catch (err: any) {
      error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Brand Panel */}
      <div className="login-brand-panel">
        <div>
          <div className="login-hero">
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                background: "rgba(39, 105, 215, 0.22)",
                color: "#A8CBFD",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              Employee Leave Management System
            </span>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                lineHeight: 1.25,
                marginBottom: "16px",
              }}
            >
              Centralized Corporate Leave Platform
            </h1>
            {/* <p style={{ color: '#bdc8da', fontSize: '14px', lineHeight: 1.6 }}>
              Automated leave requests, Director and HR approval workflows, instant notifications, leave tracking, and executive reports.
            </p> */}
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="login-form-panel">
        <div className="login-form-content">
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#17223A" }}>
              Sign In
            </h2>
            <p style={{ fontSize: "13px", color: "#7E8798", marginTop: "6px" }}>
              Enter your credentials to access your leave account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">
                Employee ID or Corporate Email
              </label>
              <input
                id="login-identifier"
                type="text"
                className="form-input"
                placeholder="e.g. EMP-101 or name@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    border: 0,
                    padding: 4,
                    background: "transparent",
                    color: "#64748b",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {showPassword ? (
                    <EyeOffIcon size={18} />
                  ) : (
                    <EyeIcon size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: "8px" }}
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign In to Portal"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
