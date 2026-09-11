"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ListChecksIcon,
  Building2Icon,
  HandshakeIcon,
  RocketIcon,
  BookOpenIcon,
  PauseCircleIcon,
  ShieldCheckIcon,
  ScaleIcon,
  SettingsIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
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

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "My Work",
    items: [{ label: "My Work", href: "/my-work", icon: ListChecksIcon }],
  },
  {
    label: "Operations",
    items: [
      { label: "Customer Onboarding", href: "/forms/customer-onboarding", icon: UserPlusIcon },
      { label: "Customers", href: "/customers", icon: Building2Icon },
      { label: "Commercials", href: "/commercials", icon: HandshakeIcon },
      { label: "Go-Live", href: "/go-live", icon: RocketIcon },
      { label: "Ledger", href: "/ledger", icon: BookOpenIcon },
      { label: "Suspensions", href: "/suspensions", icon: PauseCircleIcon },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Approvals", href: "/approvals", icon: ShieldCheckIcon },
      { label: "Legal", href: "/legal", icon: ScaleIcon },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", icon: SettingsIcon }],
  },
]

function AppSidebar() {
  const pathname = usePathname()

  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          Nexus
        </span>
      </SidebarHeader>
      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
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
    </Sidebar>
  )
}

/**
 * Responsive shell (docs/UI_SYSTEM.md §17): unchanged fixed sidebar on
 * desktop/laptop, a compact top bar with a menu trigger on narrower
 * screens. Both render the same AppSidebar/NAV_SECTIONS, so there is one
 * navigation definition; `useIsMobile` (src/hooks/use-mobile.ts) switches
 * Sidebar between its fixed and Sheet-drawer rendering purely via a
 * `window.matchMedia` breakpoint, never a user-agent check. The mobile
 * top bar is hidden at `md` and above so it never doubles up with the
 * desktop sidebar header.
 */
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "14rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
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
