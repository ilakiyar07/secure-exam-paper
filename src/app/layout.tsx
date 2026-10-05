import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecureExamPaper — Question Paper Management System",
  description: "Secure cloud-based competitive examination question paper management system with encryption, integrity verification, and controlled release.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
