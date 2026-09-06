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

  return (
    <Sidebar collapsible="none" className="w-56 border-r">
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
                        render={<Link href={item.href} />}
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

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}

export { AppShell }
