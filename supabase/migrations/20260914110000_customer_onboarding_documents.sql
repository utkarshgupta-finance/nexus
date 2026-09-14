-- Nexus: Customer Documents (task Phase D), Onboarding slice.
--
-- Closes a real gap found while auditing Approval UX (task Phase F):
-- Customer Onboarding's attachment upload has, until now, only ever
-- held a selected file in browser React state
-- (src/features/customer-onboarding/domain/documents.ts's own header:
-- "There is no upload to Supabase Storage yet... currently held only
-- as local, in-session state"). Every GST/PAN/TAN/Company Registration/
-- Commercial Document/Signed Agreement a user ever uploaded during
-- onboarding was silently discarded the moment the tab closed.
--
-- Implements exactly the shape already documented and designed for
-- this in src/features/customer-onboarding/domain/types.ts's
-- `PersistedOnboardingDocumentMetadata`: a private Storage bucket
-- (`customer-onboarding-documents`), an opaque `{requestId}/{category}/
-- {documentType}/{documentId}.{extension}` path (never a customer
-- name/GST/PAN/TAN in the path itself), and this table holding only
-- metadata, never file bytes.
--
-- "Replacing" a document (re-uploading the same documentType on the
-- same request, e.g. after Send Back) never deletes or overwrites the
-- old evidence: the old row's `is_current` flips to false and a new
-- row is inserted, so a fully historical record of every document ever
-- submitted survives, matching this project's append-only evidence
-- discipline (customer_field_history, audit_log). The protection
-- trigger below allows ONLY that one column to ever change.
--
-- This file has not been applied to any database as of authoring.

insert into storage.buckets (id, name, public)
values ('customer-onboarding-documents', 'customer-onboarding-documents', false)
on conflict (id) do nothing;

-- No RLS policy is added for anon/authenticated on storage.objects for
-- this bucket, deliberately: every read/write is mediated by a Server
-- Action using the service_role client (docs/AUTHORIZATION_MODEL.md's
-- established trust boundary for this whole project), never a direct
-- browser-to-Storage call. RLS stays enabled with no policy, so those
-- roles are denied by default; service_role bypasses RLS entirely.

create table customer_onboarding_documents (
  document_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id),
  category text not null check (category in ('tax', 'commercial', 'agreement')),
  document_type text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  storage_bucket text not null,
  storage_path text not null,
  uploaded_by uuid references app_users (id),
  uploaded_at timestamptz not null default now(),
  is_current boolean not null default true
);

comment on table customer_onboarding_documents is
  'Persisted metadata for a Customer Onboarding evidence document (docs/CUSTOMER_LIFECYCLE.md §15). File bytes live in Supabase Storage (storage_bucket/storage_path); this table never holds them. is_current is the only column ever allowed to change after insert (fn_protect_customer_onboarding_document_lifecycle).';

create index idx_customer_onboarding_documents_request_id on customer_onboarding_documents (request_id, is_current);

revoke all on customer_onboarding_documents from anon, authenticated;
grant select, insert, update on customer_onboarding_documents to service_role;

create or replace function fn_protect_customer_onboarding_document_lifecycle()
returns trigger
language plpgsql
as $function$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'customer_onboarding_documents is permanent evidence: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. is_current is the only column ever permitted to change.
  v_old_core := to_jsonb(old) - 'is_current';
  v_new_core := to_jsonb(new) - 'is_current';

  if v_old_core is distinct from v_new_core then
    raise exception 'customer_onboarding_documents is permanent evidence: only is_current may change (document_id=%)', old.document_id;
  end if;

  return new;
end;
$function$;

create trigger trg_customer_onboarding_documents_protect_lifecycle
  before update or delete on customer_onboarding_documents
  for each row execute function fn_protect_customer_onboarding_document_lifecycle();
