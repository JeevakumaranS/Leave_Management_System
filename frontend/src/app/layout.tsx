import './globals.css';
import { Montserrat } from 'next/font/google';
import { AuthProvider } from '../lib/auth-context';
import { ToastProvider } from '../components/Toast';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700', '800'],
  fallback: ['sans-serif'],
  display: 'swap',
});

export const metadata = {
  title: 'Durozen Technologies - Leave Management System',
  description: 'Centralized Employee Leave Application and Approval Portal for Durozen Technologies Private Limited',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className={montserrat.className}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
