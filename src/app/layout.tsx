import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Yard Sale Bagels — Ops",
  description: "Plan the week, calculate prep, order ingredients, and learn from your sales.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="md:flex md:min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>
            <footer className="px-4 py-6 text-center text-xs text-crust/40">
              Yard Sale Bagels Ops · plan · prep · order · insights
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
