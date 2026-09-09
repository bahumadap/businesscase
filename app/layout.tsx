import type { Metadata } from "next";
import { Funnel_Display, Geist_Mono } from "next/font/google";
import "./globals.css";

const funnelDisplay = Funnel_Display({ variable: "--font-funnel", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "YOL1 Financial Planning",
  description: "Planificación financiera, roadmap de productos y dashboard gerencial de YOL1.",
  icons: { icon: "/yol1-mark.svg", shortcut: "/yol1-mark.svg" },
  openGraph: {
    title: "YOL1 Financial Planning",
    description: "Planificación financiera y roadmap de productos",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "YOL1 Financial Planning" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YOL1 Financial Planning",
    description: "Planificación financiera y roadmap de productos",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={`${funnelDisplay.variable} ${geistMono.variable}`}>{children}</body></html>;
}
