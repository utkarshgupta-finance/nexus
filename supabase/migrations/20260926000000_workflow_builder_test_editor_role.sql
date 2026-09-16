-- Nexus: Batch 1 Journey Validation (Workflow Builder authoring mechanics).
--
-- K-014/K-015/K-016 each require a persona holding workflow_definition.write
-- but NOT workflow_definition.publish, to prove the write/publish permission
-- split is genuinely enforced server-side, not merely additive. The only
-- existing role granting any workflow_definition permission is workflow_admin,
-- which bundles read+write+publish together (confirmed via direct query of
-- role_permissions before writing this migration). No existing role can
-- construct a write-only persona.
--
-- This adds one test-scoped role, workflow_editor_test, granting read+write
-- only, matching the existing illustrative-role convention (maker/checker,
-- reference_master_viewer/admin, etc are all fictional catalog names, not
-- real org titles). Fictional, test-scoped, no production behavior change:
-- purely additive seed data (a new role + its permission grants), not a
-- schema change.

insert into roles (code, name, description) values
  ('workflow_editor_test', 'Workflow Editor (Test)', 'Test-only role: can view and edit Workflow Builder drafts but cannot publish, activate, or replace an active definition. Used to validate the write/publish permission split.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'workflow_editor_test'
  and p.resource = 'workflow_definition'
  and p.action in ('read', 'write')
on conflict (role_id, permission_id) where revoked_at is null do nothing;
