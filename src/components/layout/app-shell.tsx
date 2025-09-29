"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

interface Props {
  children: ReactNode;
}

const links = [
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: Props) {
  const { data } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xl font-semibold text-primary">
              mysight.net
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded px-2 py-1 transition",
                    pathname.startsWith(link.href)
                      ? "bg-primary/20 text-primary"
                      : "text-slate-300 hover:text-primary",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span>{data?.user?.email}</span>
            <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide">
              {data?.user?.role}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
