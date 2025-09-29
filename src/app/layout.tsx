import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "@/providers/session-provider";
import { ReactQueryProvider } from "@/providers/react-query-provider";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "mysight Multiprojektplattform",
  description:
    "Produktionsreifes Multiprojekt- und Task-Management für mysight auf dem Raspberry Pi.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="de" className="h-full">
      <body className="min-h-full bg-slate-950 font-sans text-slate-100">
        <SessionProvider session={session}>
          <ReactQueryProvider>
            <div className="flex min-h-full flex-col">
              {children}
            </div>
            <Toaster richColors theme="dark" position="top-right" />
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
