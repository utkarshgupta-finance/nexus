import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/product/app-shell";
import type { AppShellSession } from "@/components/product/app-shell";
import { getCurrentNexusSession } from "@/platform/auth/server";
import { sessionHasPermission } from "@/platform/permissions";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus",
  description: "Finance Process Platform",
};

/**
 * Reads the current session once per request, server-side, and passes
 * down only what the shell needs to render (task correction §21: nav
 * visibility is convenience only, so this is the one place that
 * translates a real `NexusSession` into that minimal, non-authoritative
 * shape; every governed page still enforces its own permission
 * server-side regardless of what this renders). This makes every route
 * dynamic (`cookies()` is a per-request API), which is an accepted,
 * necessary consequence of real session-aware navigation, not an
 * oversight: a statically-cached shell could not show the right user or
 * hide Settings for the wrong one.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getCurrentNexusSession()
  const shellSession: AppShellSession =
    session.status === "unauthenticated" || session.status === "unavailable"
      ? null
      : { email: "email" in session ? session.email : null, canReadSettings: sessionHasPermission(session, "reference_master", "read") }

  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <AppShell session={shellSession}>{children}</AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
