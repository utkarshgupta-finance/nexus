import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

/**
 * A focused numeric `<input>` still receives wheel events even when the
 * user only meant to scroll the page (trackpad/mouse wheel over a
 * focused number field silently increments/decrements its value in every
 * major browser). Blurring on wheel stops that: the event is not
 * prevented, so the page keeps scrolling normally, but the input is no
 * longer focused, so the browser's native number-input wheel behavior no
 * longer applies to it. This never interferes with keyboard entry, only
 * with wheel/trackpad scroll.
 */
function blurOnWheel(event: React.WheelEvent<HTMLInputElement>) {
  event.currentTarget.blur()
}

function Input({ className, type, onWheel, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      onWheel={type === "number" ? blurOnWheel : onWheel}
      className={cn(
        "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // Hides the native up/down spinner (task correction: trackpad/mouse
        // wheel over a focused number input could otherwise change its
        // value by accident). A reusable treatment on the shared Input
        // primitive itself, not one-off CSS repeated on every numeric field.
        type === "number" && "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
}

export { Input }
