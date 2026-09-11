import { PageHeader } from "@/components/product/page-header"
import { CustomerMasterDetail } from "@/features/customers/ui/customer-master-detail"
import { getCustomerMasterDetailByKey } from "@/features/customers/server"

/**
 * Customer Master detail: one record, read-only (task spec §15, §18).
 * Same server-side read boundary as /customers (see that route's own
 * comment): safe today because this table holds only synthetic demo
 * data, wrapped so a missing Supabase credential in this environment
 * shows an honest message instead of crashing the page.
 *
 * `dynamic = "force-dynamic"` explicitly, matching /customers/page.tsx's
 * own reasoning: this route already rendered dynamically because a
 * dynamic segment with no generateStaticParams cannot be prerendered,
 * but that is an implicit consequence of the current file shape, not a
 * guarantee. Declaring it explicitly means a future refactor (for
 * example, adding generateStaticParams) cannot silently reintroduce the
 * stale-static-read bug fixed on the list route.
 */
export const dynamic = "force-dynamic"

export default async function CustomerMasterDetailRoute({
  params,
}: {
  params: Promise<{ customerKey: string }>
}) {
  const { customerKey } = await params

  let detail: Awaited<ReturnType<typeof getCustomerMasterDetailByKey>> = null
  let unavailable = false
  try {
    detail = await getCustomerMasterDetailByKey(customerKey)
  } catch {
    unavailable = true
  }

  if (unavailable) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Customer" description="Customer Master backend read is not available in this environment right now." />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Customer not found" description={`No Customer Master record exists for "${customerKey}".`} />
      </div>
    )
  }

  return <CustomerMasterDetail detail={detail} />
}
