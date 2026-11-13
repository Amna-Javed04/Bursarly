import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ChatWidget from "./components/ChatWidget";
import ScrollProgress from "./components/motion/ScrollProgress";
import { AuthProvider } from "./context/AuthContext";

export const metadata: Metadata = {
  title: "Bursarly — Scholarships, Deadlines, Sorted",
  description:
    "Track scholarship deadlines, browse curated opportunities, and never miss an application date. Bursarly helps students worldwide find and apply on time.",
  keywords: ["scholarships", "deadlines", "tracking", "student", "bursary", "financial aid"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <div className="page-canvas" aria-hidden="true" />
        <AuthProvider>
          <ScrollProgress />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
