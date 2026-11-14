import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeroSense - Civic Air Quality Briefing Studio",
  description:
    "AI-driven civic intelligence turning raw, messy air quality data into actionable local interventions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
