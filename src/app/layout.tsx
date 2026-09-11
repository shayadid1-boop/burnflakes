import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ברנפלקס — ניהול תקציב הקמפ",
  description: "תקציב, הוצאות, חברים ומשמרות של קמפ ברנפלקס",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        {children}
      </body>
    </html>
  );
}
