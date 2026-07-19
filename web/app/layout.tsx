import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MarketBackground } from "@/components/MarketBackground";

export const metadata: Metadata = {
  title: "RobinMarkets — Stocks & RWA prediction markets",
  description:
    "Trade binary predictions on tokenized Stocks and Real-World Assets, settled on Robinhood Chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <MarketBackground />
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">{children}</main>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
