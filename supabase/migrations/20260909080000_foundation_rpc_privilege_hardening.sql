-- Nexus: Foundation RPC privilege hardening.
--
-- Retrospective hardening checkpoint, per the locked
-- docs/FOUNDATION_RPC_PRIVILEGE_HARDENING_DESIGN.md. Reasserts the
-- complete intended EXECUTE privilege boundary for the five existing
-- application/domain RPCs created in Migrations 4 and 5
-- (public.create_form_version, public.publish_form_version,
-- public.create_request_with_draft, public.submit_revision,
-- public.create_next_revision): PUBLIC/anon/authenticated denied,
-- service_role explicitly granted. No function body, SECURITY mode,
-- table privilege, RLS, or other schema change. If any of the five
-- expected signatures does not exist, this migration fails loudly rather
-- than silently producing a partially hardened state.
--
-- This file has not been applied to any database.

revoke execute on function
  public.create_form_version(uuid, uuid, uuid, jsonb, jsonb, text, text),
  public.publish_form_version(uuid, integer, uuid, uuid, jsonb),
  public.create_request_with_draft(uuid, uuid, jsonb, uuid, uuid, jsonb),
  public.submit_revision(uuid, integer, jsonb, uuid, uuid, jsonb),
  public.create_next_revision(uuid, uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.create_form_version(uuid, uuid, uuid, jsonb, jsonb, text, text) to service_role;
grant execute on function public.publish_form_version(uuid, integer, uuid, uuid, jsonb) to service_role;
grant execute on function public.create_request_with_draft(uuid, uuid, jsonb, uuid, uuid, jsonb) to service_role;
grant execute on function public.submit_revision(uuid, integer, jsonb, uuid, uuid, jsonb) to service_role;
grant execute on function public.create_next_revision(uuid, uuid, uuid, uuid, jsonb) to service_role;
