import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { SupabaseRecoveryRedirect } from "@/components/auth/SupabaseRecoveryRedirect";
import { ToastProvider } from "@/components/ui/ToastProvider";
import "./globals.css";

export const metadata = {
  title: "Cheque-Inn — Smart Workforce Management",
  description:
    "Manage attendance, payroll, and staff operations effortlessly. Built for modern teams.",

  openGraph: {
    title: "Cheque-Inn — Smart Workforce Management",
    description:
      "Manage attendance, payroll, and staff operations effortlessly. Built for modern teams.",
    url: "https://chequeinn.com",
    siteName: "Cheque-Inn",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Cheque-Inn — Smart Workforce Management",
    description:
      "Manage attendance, payroll, and staff operations effortlessly.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SupabaseRecoveryRedirect />
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
