import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AeroSense - Civic Air Quality Briefing Studio",
  description:
    "AI-driven civic intelligence turning raw, messy air quality data into actionable local interventions, traceable audits, role-based recommendations, brief comparisons, and multilingual advisories.",
  openGraph: {
    title: "AeroSense - Civic Air Quality Briefing Studio",
    description:
      "AI-driven civic intelligence turning raw, messy air quality data into actionable local interventions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="antialiased bg-[#F7F8FA] text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
