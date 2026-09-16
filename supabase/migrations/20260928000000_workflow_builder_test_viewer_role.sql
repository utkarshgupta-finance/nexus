-- Nexus: Batch 2 Journey Validation (Workflow Builder read-only pass).
--
-- K-027 requires a persona holding only workflow_definition.read (no write,
-- no publish) to prove the Builder canvas is genuinely safe to expose to a
-- read-only stakeholder (e.g. an auditor): every mutating control must be
-- either hidden or, if invoked directly, rejected server-side. The only
-- existing workflow_definition roles are workflow_admin (read+write+publish)
-- and workflow_editor_test (read+write, added in Batch 1). Neither can
-- construct a read-only persona.
--
-- This adds one test-scoped role, workflow_viewer_test, granting read only,
-- matching the existing illustrative-role convention (maker/checker,
-- reference_master_viewer/admin, workflow_editor_test, etc are all
-- fictional catalog names, not real org titles). Fictional, test-scoped,
-- no production behavior change: purely additive seed data (a new role +
-- its permission grant), not a schema change.

insert into roles (code, name, description) values
  ('workflow_viewer_test', 'Workflow Viewer (Test)', 'Test-only role: can view Workflow Builder definitions, versions, and graphs but cannot create, edit, publish, activate, or discard anything. Used to validate the Builder is safe to expose read-only.')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'workflow_viewer_test'
  and p.resource = 'workflow_definition'
  and p.action = 'read'
on conflict (role_id, permission_id) where revoked_at is null do nothing;
