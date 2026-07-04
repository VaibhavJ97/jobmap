import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobMap — European job search on a map",
  description:
    "Search European tech jobs across multiple sources, ranked by relevance and plotted on an interactive map. Built by Vaibhav Jaiswal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
