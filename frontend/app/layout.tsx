import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MillTrace PK",
  description: "Sugar mill traceability and anti-diversion dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
