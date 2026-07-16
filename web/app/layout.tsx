import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "RobinMarkets — Stocks & RWA prediction markets",
  description:
    "Trade binary predictions on tokenized Stocks and Real-World Assets, settled on Robinhood Chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
