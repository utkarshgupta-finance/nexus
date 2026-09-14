"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/**
 * Shared sub-navigation between Settings pages (Customer Onboarding
 * Settings, User Access): Settings has grown past one single page (task
 * Phase J), so a visitor on either needs a way to reach the other
 * without going back through the sidebar. Each entry is gated by the
 * caller passing only the ones the current session can actually read;
 * this component never makes its own permission decision.
 */
type SettingsNavItem = { href: string; label: string }

function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname()
  if (items.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 border-b px-4 sm:px-6">
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export { SettingsNav }
export type { SettingsNavItem }
