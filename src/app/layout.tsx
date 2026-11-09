import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARK Omniscience — Autonomous Creature Research Division",
  description:
    "Multi-agent research laboratory for ARK: Survival Evolved: creature synergy discovery, buff interaction analysis, raid intelligence, breeding strategy and experimental validation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
