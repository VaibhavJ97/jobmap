import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://vaibhavj97-jobmap.vercel.app"),
  title: "JobMap - European job search on a map",
  description:
    "Search European tech jobs across multiple sources, ranked by relevance and plotted on an interactive map. Built by Vaibhav Jaiswal.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f7f5f0'/%3E%3Ctext x='50' y='72' text-anchor='middle' fill='%232d6a4f' font-family='Georgia, serif' font-weight='700' font-style='italic' font-size='70'%3EV%3C/text%3E%3C/svg%3E",
  },
  openGraph: {
    title: "JobMap - European tech jobs on one map",
    description:
      "Many free job sources, searched at once, ranked by relevance and plotted on an interactive map.",
    url: "https://vaibhavj97-jobmap.vercel.app",
    siteName: "JobMap",
    type: "website",
    images: [
      {
        url: "/og-jobmap.png",
        width: 1200,
        height: 630,
        alt: "JobMap - European tech jobs searched across many sources and plotted on a map",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JobMap - European tech jobs on one map",
    description:
      "Many free job sources, searched at once, ranked by relevance and plotted on an interactive map.",
    images: ["/og-jobmap.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500;1,6..72,600&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <Providers>
          <Nav />
          <div className="site-main">{children}</div>
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
