import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import { ToastProvider } from "../components/Toast";

export const metadata = {
  title: "Leave Management System",
  description:
    "Centralized Employee Leave Application and Approval Portal",
  icons: {
    icon: "/logoo.png",
    shortcut: "/logoo.png",
    apple: "/logoo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
