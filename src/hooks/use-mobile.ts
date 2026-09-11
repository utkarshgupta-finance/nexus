import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * `useSyncExternalStore` (React's own hydration-safe primitive for
 * exactly this class of problem, not custom infrastructure) instead of
 * `useState` + `useEffect`: it guarantees the server snapshot (`false`,
 * there is no viewport on the server) is what both the server render AND
 * the client's first hydration render use, so the two always agree.
 * React swaps in the real client snapshot only after hydration commits,
 * the same "reveal the real value after mount" behavior the previous
 * implementation wanted, without ever evaluating `window` during the
 * render React has to match against the server.
 *
 * The previous implementation computed `window.innerWidth` directly
 * inside a `useState` initializer via a `typeof window !== "undefined"`
 * branch. That branch is `false` on the server (no `window`) but runs
 * for real on the client's very first render, so on any viewport
 * narrower than the breakpoint the client picked a different Sidebar
 * branch (the mobile Sheet) than the server had already rendered (the
 * desktop div), producing a hydration mismatch. See
 * `docs/UI_SYSTEM.md` §17 for the responsive behavior this preserves.
 */
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getClientSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
