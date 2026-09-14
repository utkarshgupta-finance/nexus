-- Nexus: Go Live + Entitlement Ledger, Phase B. Go Live as a first-class
-- governed domain, plus the stable commercial line-item identity it
-- (and the future Entitlement Ledger) needs to anchor against.
--
-- =============================================================================
-- Stable commercial line-item identity (additive, no redesign)
-- =============================================================================
--
-- commercial_components.id is minted fresh by add_commercial_component on
-- EVERY version approval (verified by inspection: approve_commercial_configuration_version
-- and approve_customer_onboarding_case both call gen_random_uuid() per
-- component every time). There is today no column that ties "this SFA
-- per-user line item in version 2" to "the same line item in version 3."
-- commercial_components.supersedes_component_id exists in the schema but
-- is never populated by any RPC.
--
-- stable_component_key is purely additive: it does not replace `id`,
-- does not change `add_commercial_component`'s signature, and does not
-- touch the existing Current-vs-Proposed diff mechanism
-- (commercial-rate-diff.ts's own id-based matching is untouched). It is
-- populated by the two approval RPCs immediately after each component
-- row is minted: continuing a component copies the key forward from the
-- version-editor's own existing "this draft item reconstructs real row
-- X" mechanism (toDraftComponent already sets draft.id to the active
-- component's real id, Program 4 and earlier); a genuinely new line
-- item gets a fresh key equal to its own new id.
alter table commercial_components add column stable_component_key uuid;

-- commercial_components carries fn_protect_commercial_component_lifecycle,
-- an immutability trigger permitting only effective_to (once, from
-- null), updated_at, and updated_by to change. stable_component_key
-- needs the identical "settable exactly once, from null" allowance, so
-- the trigger function is extended (not weakened: DELETE stays
-- forbidden, every other column stays frozen) before this migration's
-- own backfill/RPC writes touch the column.
create or replace function fn_protect_commercial_component_lifecycle()
returns trigger
language plpgsql
as $function$
declare
  v_old_core jsonb;
  v_new_core jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'commercial_components is an immutable Finance record: DELETE is not permitted';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  -- tg_op = 'UPDATE'. effective_to, stable_component_key (Go Live +
  -- Entitlement Ledger), updated_at, and updated_by are the only
  -- columns ever permitted to change.
  v_old_core := to_jsonb(old) - 'effective_to' - 'stable_component_key' - 'updated_at' - 'updated_by';
  v_new_core := to_jsonb(new) - 'effective_to' - 'stable_component_key' - 'updated_at' - 'updated_by';

  if v_old_core is distinct from v_new_core then
    raise exception
      'commercial_components: only effective_to (once, from null), stable_component_key '
      '(once, from null), updated_at, and updated_by may change (id=%)', old.id;
  end if;

  if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
    raise exception
      'commercial_components: effective_to is already set and cannot change again (id=%)',
      old.id;
  end if;

  if old.stable_component_key is not null and new.stable_component_key is distinct from old.stable_component_key then
    raise exception
      'commercial_components: stable_component_key is already set and cannot change again (id=%)',
      old.id;
  end if;

  return new;
end;
$function$;

update commercial_components set stable_component_key = id where stable_component_key is null;

alter table commercial_components alter column stable_component_key set not null;

create index idx_commercial_components_stable_key on commercial_components (stable_component_key);

comment on column commercial_components.stable_component_key is
  'Go Live + Entitlement Ledger: the identity that persists across Commercial Versions for the same continuing commercial line item, distinct from id (which is minted fresh on every version approval). Populated by approve_commercial_configuration_version/approve_customer_onboarding_case from the approval payload''s own stable_component_key field, falling back to the row''s own new id when the line item is genuinely new.';

-- =============================================================================
-- Resource Registry: go_live_request joins the existing 4 resource types
-- =============================================================================

insert into resource_types (type_code, description) values
  ('go_live_request', 'A governed Go Live request for one recurring Commercial line item.')
on conflict (type_code) do nothing;

-- =============================================================================
-- go_live_requests
-- =============================================================================
--
-- Deliberately NOT routed through requests/submission_revisions (unlike
-- Onboarding/Change Request/Commercial Version): Go Live has a small,
-- fixed set of editable fields (go_live_date, prorate_first_month,
-- confirmation attachments), not a dynamic SurveyJS-authored form. Every
-- OTHER convention is still followed exactly: resource-backed, human-
-- friendly id, created/sent-back/approved/cancelled actor+timestamp
-- columns, FOR UPDATE + status-guard concurrency, self-approval control,
-- audit-triggered for the actor snapshot.
--
-- Line-item-level Go Live status (NO_GO_LIVE / GO_LIVE_PENDING / LIVE /
-- CANCELLED, per the product brief) is deliberately NOT a stored column
-- here: it is derived in TypeScript from the set of go_live_requests
-- rows for a given stable_component_key, the same "compute status from
-- data, never store redundant derived state" convention Commercial
-- Version's own scheduled/active/superseded distinction already uses.

create sequence go_live_request_number_seq;

create table go_live_requests (
  id                          uuid primary key default gen_random_uuid(),
  request_number              integer not null default nextval('go_live_request_number_seq'),
  customer_id                 uuid not null references customers (id) on delete restrict,
  commercial_configuration_id uuid not null references commercial_configurations (id) on delete restrict,
  commercial_version_id       uuid not null references commercial_configuration_versions (request_id) on delete restrict,
  stable_component_key        uuid not null,
  go_live_date                date not null,
  prorate_first_month         boolean not null default false,
  customer_confirmation_status text not null default 'pending' check (customer_confirmation_status in ('pending', 'confirmed')),
  status                      text not null default 'draft' check (status in ('draft', 'submitted', 'sent_back', 'resubmitted', 'approved', 'cancelled')),
  workflow_version_id         uuid references workflow_definition_versions (id) on delete restrict,
  comment                     text,
  sent_back_reason            text,
  sent_back_by                uuid references app_users (id) on delete restrict,
  sent_back_at                timestamptz,
  approved_by                 uuid references app_users (id) on delete restrict,
  approved_at                 timestamptz,
  cancelled_by                uuid references app_users (id) on delete restrict,
  cancelled_at                timestamptz,
  cancelled_reason            text,
  created_at                  timestamptz not null default now(),
  created_by                  uuid references app_users (id) on delete restrict,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references app_users (id) on delete restrict
);

comment on table go_live_requests is
  'Go Live + Entitlement Ledger, Phase B. Go Live means the recurring commercial line item is commercially active from the Go Live month and entitlement allocation/usage consumption may begin. It does NOT mean an invoice exists, technical deployment finished, billing was raised, or revenue was recognized.';

create index idx_go_live_requests_stable_component_key on go_live_requests (stable_component_key);
create index idx_go_live_requests_customer_id on go_live_requests (customer_id);
create index idx_go_live_requests_status on go_live_requests (status);

create trigger trg_go_live_requests_updated_at
  before update on go_live_requests
  for each row execute function fn_set_updated_at();

alter table go_live_requests enable row level security;

create trigger trg_audit_go_live_requests
  after insert or update or delete on go_live_requests
  for each row execute function fn_audit_row('id');

-- =============================================================================
-- go_live_send_backs: permanent history, matching
-- customer_onboarding_send_backs' exact shape.
-- =============================================================================

create table go_live_send_backs (
  id                uuid primary key default gen_random_uuid(),
  go_live_request_id uuid not null references go_live_requests (id) on delete restrict,
  reason            text not null,
  sent_back_by      uuid references app_users (id) on delete restrict,
  sent_back_at      timestamptz not null default now()
);

comment on table go_live_send_backs is
  'Permanent, one-row-per-send-back history for a Go Live request, matching customer_onboarding_send_backs exactly.';

create index idx_go_live_send_backs_request_id on go_live_send_backs (go_live_request_id, sent_back_at);

revoke all on go_live_send_backs from anon, authenticated;

-- =============================================================================
-- go_live_documents: customer confirmation evidence. A parallel table
-- following customer_onboarding_documents' exact established shape
-- (opaque path, supersede-not-delete, private bucket, signed download),
-- not a shared table: the Documents platform is not yet generalized
-- across features (confirmed by inspection), so this is the same kind
-- of feature-owned table onboarding itself has, not a second competing
-- design.
-- =============================================================================

create table go_live_documents (
  document_id       uuid primary key default gen_random_uuid(),
  go_live_request_id uuid not null references go_live_requests (id) on delete restrict,
  document_type     text not null check (document_type in ('customer_confirmation', 'signed_uat_document')),
  original_file_name text not null,
  mime_type         text not null,
  size_bytes        bigint not null,
  storage_bucket    text not null,
  storage_path      text not null,
  uploaded_by       uuid references app_users (id) on delete restrict,
  uploaded_at       timestamptz not null default now(),
  is_current        boolean not null default true
);

comment on table go_live_documents is
  'Customer confirmation evidence for a Go Live request: an uploaded customer email/written confirmation, or a signed Go Live/UAT document. An internal declaration alone is never valid evidence (enforced at the application-service layer, not here).';

create index idx_go_live_documents_request_id on go_live_documents (go_live_request_id, document_type, is_current);

create or replace function fn_protect_go_live_document_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'GO_LIVE_DOCUMENT_IMMUTABLE: go_live_documents rows are never deleted, only superseded via is_current';
  end if;

  if tg_op = 'UPDATE' then
    if old.go_live_request_id is distinct from new.go_live_request_id
      or old.document_type is distinct from new.document_type
      or old.original_file_name is distinct from new.original_file_name
      or old.mime_type is distinct from new.mime_type
      or old.size_bytes is distinct from new.size_bytes
      or old.storage_bucket is distinct from new.storage_bucket
      or old.storage_path is distinct from new.storage_path
      or old.uploaded_by is distinct from new.uploaded_by
      or old.uploaded_at is distinct from new.uploaded_at
    then
      raise exception 'GO_LIVE_DOCUMENT_IMMUTABLE: only is_current may ever change on go_live_documents after insert';
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_protect_go_live_document_lifecycle
  before update or delete on go_live_documents
  for each row execute function fn_protect_go_live_document_lifecycle();

alter table go_live_documents enable row level security;

revoke all on go_live_documents from anon, authenticated;

-- =============================================================================
-- Permission catalog: Go Live
-- =============================================================================

insert into permissions (resource, action, description) values
  ('go_live', 'read', 'View Go Live requests and status for recurring Commercial line items.'),
  ('go_live', 'create', 'Create and edit a draft Go Live request (the maker side).'),
  ('go_live', 'submit', 'Submit a Go Live request for review.'),
  ('go_live', 'approve', 'Approve, reject, or send back a Go Live request (the checker side).')
on conflict (resource, action) do nothing;

insert into roles (code, name, description) values
  ('go_live_admin', 'Go Live Admin', 'Can view, create, submit, and approve Go Live requests.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'go_live_admin'
  and p.resource = 'go_live'
  and p.action in ('read', 'create', 'submit', 'approve')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- Extend the existing maker/checker roles (Platform Operating Expansion,
-- Phase L) additively: maker gets create/submit, checker gets all of
-- maker's plus approve. No new role invented for this; Go Live joins
-- the same maker/checker vocabulary as everything else.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'maker'
  and p.resource = 'go_live'
  and p.action in ('read', 'create', 'submit')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'checker'
  and p.resource = 'go_live'
  and p.action in ('read', 'create', 'submit', 'approve')
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- =============================================================================
-- RPCs
-- =============================================================================

/** Snapshots the customer's current row_version-free identity is not needed here (Go Live never mutates customers); locks the commercial_configuration_versions row only to confirm it is approved (a Go Live cannot be created against a draft/rejected version). workflow_version_id is resolved once at creation, from the currently published go_live workflow definition version if one exists, and never re-resolved afterward: "in-flight Go Live requests retain the Workflow Version they started with." */
create function create_go_live_request(
  p_id uuid,
  p_customer_id uuid,
  p_commercial_configuration_id uuid,
  p_commercial_version_id uuid,
  p_stable_component_key uuid,
  p_go_live_date date,
  p_prorate_first_month boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
  v_workflow_version_id uuid;
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_commercial_version_id;
  if not found then
    raise exception 'GO_LIVE_COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for %', p_commercial_version_id;
  end if;

  if v_version.status <> 'approved' then
    raise exception 'GO_LIVE_COMMERCIAL_VERSION_NOT_APPROVED: version % has status %, a Go Live request may only reference an approved version', p_commercial_version_id, v_version.status;
  end if;

  select wdv.id into v_workflow_version_id
  from workflow_definition_versions wdv
  join workflow_definitions wd on wd.id = wdv.workflow_definition_id
  where wd.applies_to = 'go_live' and wd.is_active and wdv.status = 'published'
  order by wdv.version_number desc
  limit 1;

  insert into resources (resource_id, resource_type, created_by)
  values (p_id, 'go_live_request', p_actor_user_id);

  insert into go_live_requests (
    id, customer_id, commercial_configuration_id, commercial_version_id, stable_component_key,
    go_live_date, prorate_first_month, workflow_version_id, created_by, updated_by
  )
  values (
    p_id, p_customer_id, p_commercial_configuration_id, p_commercial_version_id, p_stable_component_key,
    p_go_live_date, p_prorate_first_month, v_workflow_version_id, p_actor_user_id, p_actor_user_id
  )
  returning * into v_row;

  return v_row;
end;
$function$;

create function save_go_live_request_draft(
  p_id uuid,
  p_go_live_date date,
  p_prorate_first_month boolean,
  p_comment text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_EDITABLE: request % has status %, only a draft or sent-back request may be edited', p_id, v_row.status;
  end if;

  update go_live_requests
  set go_live_date = p_go_live_date,
      prorate_first_month = p_prorate_first_month,
      comment = p_comment,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

create function submit_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
  v_next_status text;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_SUBMITTABLE: request % has status %, only a draft or sent-back request may be submitted', p_id, v_row.status;
  end if;

  -- Submission is allowed before final customer confirmation ("Go Live
  -- workflow may be submitted before final confirmation if business
  -- workflow allows"); only the final approval below enforces it.
  v_next_status := case when v_row.status = 'sent_back' then 'resubmitted' else 'submitted' end;

  update go_live_requests
  set status = v_next_status, updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

create function send_back_go_live_request(
  p_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'GO_LIVE_SEND_BACK_REASON_REQUIRED: a reason is required to send a Go Live request back';
  end if;

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot send back your own request. Another authorized checker must review it.';
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_SENDBACKABLE: request % has status %, only submitted or resubmitted may be sent back', p_id, v_row.status;
  end if;

  update go_live_requests
  set status = 'sent_back', sent_back_reason = p_reason, sent_back_by = p_actor_user_id, sent_back_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  insert into go_live_send_backs (go_live_request_id, reason, sent_back_by)
  values (p_id, p_reason, p_actor_user_id);

  return v_row;
end;
$function$;

/** Approval is the transition to LIVE (per the product brief, there is no separate "approved" vs "live" state at the line-item level). Requires customer_confirmation_status = 'confirmed': "final transition to LIVE should require confirmation," never silently weakened. */
create function approve_go_live_request(
  p_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_row.status = 'approved' then
    return v_row;
  end if;

  if v_row.status not in ('submitted', 'resubmitted') then
    raise exception 'GO_LIVE_REQUEST_NOT_APPROVABLE: request % has status %, only submitted or resubmitted may be approved', p_id, v_row.status;
  end if;

  if v_row.customer_confirmation_status <> 'confirmed' then
    raise exception 'GO_LIVE_CONFIRMATION_REQUIRED: customer confirmation is required before a Go Live request can be approved';
  end if;

  update go_live_requests
  set status = 'approved', approved_by = p_actor_user_id, approved_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

create function cancel_go_live_request(
  p_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status not in ('draft', 'sent_back') then
    raise exception 'GO_LIVE_REQUEST_NOT_CANCELLABLE: request % has status %, only a draft or sent-back request may be cancelled', p_id, v_row.status;
  end if;

  if v_row.created_by is distinct from p_actor_user_id then
    raise exception 'GO_LIVE_REQUEST_CANCEL_NOT_OWNER: only the creator of request % may cancel it', p_id;
  end if;

  update go_live_requests
  set status = 'cancelled', cancelled_by = p_actor_user_id, cancelled_at = now(), cancelled_reason = p_reason,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

create function set_go_live_customer_confirmation(
  p_id uuid,
  p_confirmed boolean,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns go_live_requests
language plpgsql
security invoker
as $function$
declare
  v_row go_live_requests;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_row from go_live_requests where id = p_id for update;
  if not found then
    raise exception 'GO_LIVE_REQUEST_NOT_FOUND: no go_live_requests row for id %', p_id;
  end if;

  if v_row.status = 'cancelled' then
    raise exception 'GO_LIVE_REQUEST_NOT_EDITABLE: request % is cancelled, customer confirmation can no longer change', p_id;
  end if;

  update go_live_requests
  set customer_confirmation_status = case when p_confirmed then 'confirmed' else 'pending' end,
      updated_by = p_actor_user_id, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- =============================================================================
-- Stable component key propagation: additive body-only changes, no
-- signature change on either RPC (verified via pg_proc before/after).
-- =============================================================================

create or replace function approve_customer_onboarding_case(
  p_request_id uuid,
  p_customer_key text,
  p_customer_name text,
  p_commercial_configuration_key text,
  p_commercial_configuration_name text,
  p_components jsonb,
  p_effective_date date,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb,
  p_customer_fields jsonb default '{}'::jsonb
)
returns customer_onboarding_cases
language plpgsql
security invoker
as $function$
declare
  v_case customer_onboarding_cases;
  v_latest_revision submission_revisions;
  v_customer_id uuid;
  v_system_request_id uuid;
  v_commercial_configuration_id uuid;
  v_commercial_change_id uuid;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_case from customer_onboarding_cases where request_id = p_request_id for update;
  if not found then
    raise exception 'ONBOARDING_CASE_NOT_FOUND: no customer_onboarding_cases row for request %', p_request_id;
  end if;

  if v_case.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_case.status = 'approved' then
    return v_case;
  end if;

  if v_case.status not in ('submitted', 'resubmitted') then
    raise exception 'ONBOARDING_CASE_NOT_APPROVABLE: case % has status %, only submitted or resubmitted may be approved', p_request_id, v_case.status;
  end if;

  select * into v_latest_revision
  from submission_revisions
  where request_id = p_request_id and status = 'submitted'
  order by revision_number desc
  limit 1;

  if not found then
    raise exception 'ONBOARDING_NO_SUBMITTED_REVISION: case % has no submitted revision to approve', p_request_id;
  end if;

  insert into customers (
    key, name, brand_name, created_by, updated_by,
    address, state, city, postal_code, website,
    primary_contact_name, primary_contact_email, primary_contact_phone_country_code,
    primary_contact_phone_number, primary_contact_designation,
    gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number,
    company_document_type, company_document_type_other, billing_currency
  )
  values (
    p_customer_key, p_customer_name, p_customer_fields ->> 'brand_name', p_actor_user_id, p_actor_user_id,
    p_customer_fields ->> 'address', p_customer_fields ->> 'state', p_customer_fields ->> 'city',
    p_customer_fields ->> 'postal_code', p_customer_fields ->> 'website',
    p_customer_fields ->> 'primary_contact_name', p_customer_fields ->> 'primary_contact_email',
    p_customer_fields ->> 'primary_contact_phone_country_code', p_customer_fields ->> 'primary_contact_phone_number',
    p_customer_fields ->> 'primary_contact_designation',
    p_customer_fields ->> 'gst_number', p_customer_fields ->> 'pan', p_customer_fields ->> 'tan',
    p_customer_fields ->> 'tax_identifier_type', p_customer_fields ->> 'tax_identifier_name', p_customer_fields ->> 'tax_registration_number',
    p_customer_fields ->> 'company_document_type', p_customer_fields ->> 'company_document_type_other',
    p_customer_fields ->> 'billing_currency'
  )
  returning id into v_customer_id;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  v_commercial_configuration_id := gen_random_uuid();
  v_commercial_change_id := v_system_request_id;
  perform create_commercial_configuration_with_change(
    v_commercial_configuration_id, v_system_request_id, v_customer_id,
    p_commercial_configuration_key, p_commercial_configuration_name, p_effective_date,
    p_actor_user_id, null, null, null, p_actor_context
  );

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    perform add_commercial_component(
      v_new_component_id,
      v_commercial_configuration_id,
      v_commercial_change_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context
    );

    -- Every line item created at onboarding is, by definition, new: its
    -- stable identity is its own freshly-minted component id.
    update commercial_components set stable_component_key = v_new_component_id where id = v_new_component_id;

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update customer_onboarding_cases
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = now(),
      customer_id = v_customer_id,
      commercial_configuration_id = v_commercial_configuration_id,
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_case;

  return v_case;
end;
$function$;

create or replace function approve_commercial_configuration_version(
  p_request_id uuid,
  p_components jsonb,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns commercial_configuration_versions
language plpgsql
security invoker
as $function$
declare
  v_version commercial_configuration_versions;
  v_system_request_id uuid;
  v_commercial_change commercial_changes;
  v_component jsonb;
  v_new_component_id uuid;
  v_mug_threshold numeric;
  v_stable_key uuid;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from commercial_configuration_versions where request_id = p_request_id for update;
  if not found then
    raise exception 'COMMERCIAL_VERSION_NOT_FOUND: no commercial_configuration_versions row for request %', p_request_id;
  end if;

  if v_version.created_by = p_actor_user_id then
    raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.';
  end if;

  if v_version.status = 'approved' then
    return v_version;
  end if;

  if v_version.status <> 'submitted' then
    raise exception 'COMMERCIAL_VERSION_NOT_APPROVABLE: version % has status %, only submitted may be approved', p_request_id, v_version.status;
  end if;

  if exists (
    select 1 from commercial_components
    where commercial_configuration_id = v_version.commercial_configuration_id
      and effective_to is null
      and effective_from >= v_version.effective_date
  ) then
    raise exception 'COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER: version % has effective_date % which must be strictly after the currently active period''s own start date', p_request_id, v_version.effective_date;
  end if;

  v_system_request_id := gen_random_uuid();
  perform create_system_commercial_request(v_system_request_id, p_actor_user_id, p_actor_context);

  update commercial_components
  set effective_to = v_version.effective_date - 1, updated_by = p_actor_user_id, updated_at = now()
  where commercial_configuration_id = v_version.commercial_configuration_id and effective_to is null;

  insert into commercial_changes (request_id, commercial_configuration_id, change_category, effective_date, reason, created_by)
  values (v_system_request_id, v_version.commercial_configuration_id, v_version.change_category, v_version.effective_date, v_version.reason, p_actor_user_id)
  returning * into v_commercial_change;

  for v_component in select * from jsonb_array_elements(p_components)
  loop
    v_new_component_id := gen_random_uuid();
    perform add_commercial_component(
      v_new_component_id,
      v_version.commercial_configuration_id,
      v_commercial_change.request_id,
      (v_component ->> 'is_recurring')::boolean,
      v_component ->> 'pricing_rule_kind',
      v_component -> 'pricing_rule_parameters',
      v_component ->> 'billing_cadence',
      v_component ->> 'billing_timing',
      v_component ->> 'reconciliation_cadence',
      v_component ->> 'transaction_currency',
      nullif(v_component ->> 'fx_snapshot_rate', '')::numeric,
      (v_component ->> 'effective_from')::date,
      p_actor_user_id,
      v_component ->> 'billing_quantity_basis',
      null,
      null,
      p_actor_context
    );

    -- Go Live + Entitlement Ledger: propagate the stable line-item
    -- identity forward. A component the draft reconstructed from an
    -- active row (toDraftComponent seeds draft.id with that row's real
    -- id) carries stable_component_key explicitly in the payload; a
    -- genuinely new line item the user added in this version has none,
    -- and mints a fresh key equal to its own new id.
    v_stable_key := nullif(v_component ->> 'stable_component_key', '')::uuid;
    update commercial_components
    set stable_component_key = coalesce(v_stable_key, v_new_component_id)
    where id = v_new_component_id;

    v_mug_threshold := nullif(v_component ->> 'mug_threshold_value', '')::numeric;
    if v_mug_threshold is not null then
      perform add_commercial_commitment(
        gen_random_uuid(), v_commercial_change.request_id, v_new_component_id,
        v_mug_threshold, (v_component ->> 'effective_from')::date, p_actor_user_id, p_actor_context
      );
    end if;
  end loop;

  update commercial_configuration_versions
  set status = 'approved', commercial_change_id = v_commercial_change.request_id,
      decided_by = p_actor_user_id, decided_at = now(),
      updated_by = p_actor_user_id, updated_at = now()
  where request_id = p_request_id
  returning * into v_version;

  return v_version;
end;
$function$;

-- =============================================================================
-- Privilege hardening
-- =============================================================================

revoke execute on function
  create_go_live_request(uuid, uuid, uuid, uuid, uuid, date, boolean, uuid, jsonb),
  save_go_live_request_draft(uuid, date, boolean, text, uuid, jsonb),
  submit_go_live_request(uuid, uuid, jsonb),
  send_back_go_live_request(uuid, text, uuid, jsonb),
  approve_go_live_request(uuid, uuid, jsonb),
  cancel_go_live_request(uuid, text, uuid, jsonb),
  set_go_live_customer_confirmation(uuid, boolean, uuid, jsonb)
from public, anon, authenticated;

grant execute on function create_go_live_request(uuid, uuid, uuid, uuid, uuid, date, boolean, uuid, jsonb) to service_role;
grant execute on function save_go_live_request_draft(uuid, date, boolean, text, uuid, jsonb) to service_role;
grant execute on function submit_go_live_request(uuid, uuid, jsonb) to service_role;
grant execute on function send_back_go_live_request(uuid, text, uuid, jsonb) to service_role;
grant execute on function approve_go_live_request(uuid, uuid, jsonb) to service_role;
grant execute on function cancel_go_live_request(uuid, text, uuid, jsonb) to service_role;
grant execute on function set_go_live_customer_confirmation(uuid, boolean, uuid, jsonb) to service_role;
