import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Combobox, ComboboxTrigger, ComboboxValue } from "./combobox"

/**
 * PG-043 (ACC-001, Batch 8): `aria-required` was hand-set directly on
 * `ComboboxTrigger` (e.g. `aria-required={question.isRequired}`) instead of
 * passed as `required` to the `Combobox` root, which is the only prop Base
 * UI's own Trigger AND Input (the popup's search box, a second, independent
 * `role="combobox"` element) both read from. Passing it only to Trigger
 * left the Input permanently un-marked required, confirmed live in the
 * browser: `document.querySelector('[data-slot="combobox-input"]')` had no
 * `aria-required` at all. This test guards the Trigger half of the fix
 * (the part `renderToStaticMarkup` can exercise, since the popup content is
 * portal-rendered and not present in a static server render); the Input
 * half was verified live in a real browser instead, since this repo has no
 * jsdom/testing-library harness to open the popup in a unit test.
 */
describe("Combobox required threading (PG-043)", () => {
  it("exposes aria-required=true on the trigger when required is set on the root", () => {
    const html = renderToStaticMarkup(
      <Combobox items={[]} value={null} required>
        <ComboboxTrigger id="test-trigger">
          <ComboboxValue placeholder="Select...">{() => null}</ComboboxValue>
        </ComboboxTrigger>
      </Combobox>
    )
    expect(html).toContain('aria-required="true"')
  })

  it("does not expose aria-required=true on the trigger when required is not set", () => {
    const html = renderToStaticMarkup(
      <Combobox items={[]} value={null}>
        <ComboboxTrigger id="test-trigger">
          <ComboboxValue placeholder="Select...">{() => null}</ComboboxValue>
        </ComboboxTrigger>
      </Combobox>
    )
    expect(html).not.toContain('aria-required="true"')
  })
})
