"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ListChecksIcon,
  Building2Icon,
  ShieldCheckIcon,
  SettingsIcon,
  UserPlusIcon,
  LogOutIcon,
  ClipboardListIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/platform/auth/actions"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

type NavSection = {
  label: string
  items: NavItem[]
}

/**
 * What the shell needs to know about the current session to render
 * navigation/footer correctly: `null` means unauthenticated. Never the
 * raw `NexusSession` union: this is a Client Component, and the shell
 * only ever needs an email to display and one boolean to gate the
 * Settings link with, not roles/permissions internals (task correction
 * §21: "UI visibility is convenience only," so this prop deliberately
 * cannot express any real authorization decision by itself).
 */
type AppShellSession = {
  email: string | null
  canReadSettings: boolean
} | null

/**
 * Platform Scale Program, Phase M: no primary nav item may 404. Go-Live,
 * Ledger, Suspensions, and Legal were previously listed here with no
 * backing route under src/app/ at all; removed until each is a real
 * page, per the "prefer removal until useful" rule
 * (docs/TECH_DEBT.md). Add a nav entry back only in the same change that
 * adds its route.
 */
const OPERATIONS_SECTION: NavSection = {
  label: "Operations",
  items: [
    { label: "Customer Onboarding", href: "/forms/customer-onboarding", icon: UserPlusIcon },
    { label: "Customers", href: "/customers", icon: Building2Icon },
  ],
}

const GOVERNANCE_SECTION: NavSection = {
  label: "Governance",
  items: [
    { label: "Approvals", href: "/approvals", icon: ShieldCheckIcon },
    { label: "Operational Queue", href: "/operations/queue", icon: ClipboardListIcon },
  ],
}

function buildNavSections(canReadSettings: boolean): NavSection[] {
  const sections: NavSection[] = [
    { label: "My Work", items: [{ label: "My Work", href: "/my-work", icon: ListChecksIcon }] },
    OPERATIONS_SECTION,
    GOVERNANCE_SECTION,
  ]
  // Server-side authorization (requirePermission in the Settings route
  // itself) remains mandatory regardless of this; hiding the link is
  // convenience only, never the enforcement point.
  if (canReadSettings) {
    sections.push({ label: "System", items: [{ label: "Settings", href: "/settings", icon: SettingsIcon }] })
  }
  return sections
}

function AppSidebar({ session }: { session: AppShellSession }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const navSections = buildNavSections(session?.canReadSettings ?? false)

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          Nexus
        </span>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[0.65rem] font-medium tracking-wide text-sidebar-foreground/50 uppercase">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 py-3">
        {session ? (
          <div className="flex flex-col gap-2">
            <span className="truncate text-xs text-sidebar-foreground/70">{session.email ?? "Signed in"}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm" className="w-full justify-start gap-2">
                <LogOutIcon className="size-3.5" />
                Log out
              </Button>
            </form>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" render={<Link href="/login" />}>
            Log in
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * Responsive shell (docs/UI_SYSTEM.md §17): unchanged fixed sidebar on
 * desktop/laptop, a compact top bar with a menu trigger on narrower
 * screens. Both render the same AppSidebar, so there is one navigation
 * definition; `useIsMobile` (src/hooks/use-mobile.ts) switches Sidebar
 * between its fixed and Sheet-drawer rendering purely via a
 * `window.matchMedia` breakpoint, never a user-agent check. The mobile
 * top bar is hidden at `md` and above so it never doubles up with the
 * desktop sidebar header.
 *
 * `/login` renders with no sidebar chrome at all: `pathname` is read
 * with `usePathname()` here (not passed as a prop) since this is already
 * a Client Component and the check is purely presentational, never an
 * authorization decision (route protection for governed pages happens
 * server-side in each route's own Server Component, see
 * `src/app/settings/customer-onboarding/page.tsx`).
 */
function AppShell({ children, session }: { children: React.ReactNode; session: AppShellSession }) {
  const pathname = usePathname()
  if (pathname.startsWith("/login")) {
    return <>{children}</>
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline focus:outline-2 focus:outline-ring"
      >
        Skip to main content
      </a>
      <AppSidebar session={session} />
      <SidebarInset id="main-content">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold tracking-tight text-foreground">Nexus</span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

export { AppShell }
export type { AppShellSession }
