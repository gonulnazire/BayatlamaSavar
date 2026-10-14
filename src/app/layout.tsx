import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BayatlamaSavar",
  description:
    "Ambalajı açılan gıdaların raf ömrünü takip et, gıda israfını önle.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-200">
        {children}
      </body>
    </html>
  );
}
