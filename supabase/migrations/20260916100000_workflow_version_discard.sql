-- Nexus: Platform Operating Expansion, Phase V (cancel/withdraw
-- system-wide audit). A real, confirmed gap: `workflow_definition_versions`
-- has "at most one draft per definition at a time"
-- (uq_workflow_version_one_draft,
-- 20260916090000_workflow_builder_foundation.sql) but no way to discard
-- an unwanted draft. An admin who starts a draft and abandons it has no
-- path forward except force-publishing a structurally valid graph, a
-- hard dead end for that whole definition. This migration adds the
-- missing discard RPC, matching the existing cancel_* RPCs'
-- draft-only-then-mutate shape (20260916010000_draft_cancel_discard.sql),
-- except Workflow Builder has no creator-only restriction anywhere else
-- in this module (it is a shared admin resource gated by
-- workflow_definition.write, not a personal request), so discard is not
-- creator-restricted either, consistent with every other RPC in this
-- migration's own file.

/** Permanently removes a draft version and its graph (workflow_nodes/workflow_edges cascade on workflow_version_id). Never callable on a published version: publishing makes a version immutable, and discard is not a backdoor around that. */
create function discard_workflow_definition_version(
  p_version_id uuid,
  p_actor_user_id uuid,
  p_actor_context jsonb default null::jsonb
)
returns void
language plpgsql
security invoker
as $function$
declare
  v_version workflow_definition_versions;
begin
  perform set_config('app.current_user_id', coalesce(p_actor_user_id::text, ''), true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.actor_context', coalesce(p_actor_context::text, ''), true);

  select * into v_version from workflow_definition_versions where id = p_version_id for update;
  if not found then
    raise exception 'WORKFLOW_VERSION_NOT_FOUND: no workflow_definition_versions row for id %', p_version_id;
  end if;

  if v_version.status <> 'draft' then
    raise exception 'WORKFLOW_VERSION_NOT_DRAFT: version % has status %, only a draft may be discarded', p_version_id, v_version.status;
  end if;

  delete from workflow_definition_versions where id = p_version_id;
end;
$function$;

revoke execute on function discard_workflow_definition_version(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function discard_workflow_definition_version(uuid, uuid, jsonb) to service_role;
