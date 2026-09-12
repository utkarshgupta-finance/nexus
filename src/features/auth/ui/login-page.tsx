"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signInAction } from "../actions"

/**
 * Restrained Nexus login: email + password, one submit action, no
 * marketing content (task correction §8). Kept as a single Client
 * Component rather than a form posting directly to a Server Action,
 * since a redirect after success needs client-side navigation
 * (`router.push` + `router.refresh()`, so the server layout re-resolves
 * the now-authenticated session) rather than the Server Action's own
 * `redirect()`, which would otherwise redirect before the client has a
 * chance to show a brief loading state.
 */
function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await signInAction(email, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push("/my-work")
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border px-6 py-8">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold tracking-tight text-foreground">Nexus</span>
          <span className="text-xs text-muted-foreground">Sign in to continue.</span>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-medium text-foreground">
              Email
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
          ) : null}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export { LoginPage }
