-- Nexus: Platform Operating Expansion, Phase L. Maker/Checker capability
-- layer.
--
-- The task spec is explicit that Maker/Checker must never become a
-- second, competing authorization system ("do NOT use one client
-- boolean as security... integrate with RBAC... existing permission
-- system remains authoritative"). `roles`/`role_permissions` already
-- give this codebase exactly the mechanism a capability bundle needs: a
-- role is already a named bundle of permissions, and `requirePermission`
-- already checks the real resource+action, never a role name or a
-- client-supplied flag. Two new illustrative roles, `maker` and
-- `checker`, are the entire V1 of this phase: Checker is defined as
-- Maker's exact permission set plus approval on the same domains, so
-- "Checker has all Maker capabilities plus approval where domain
-- permission allows" is true by construction, not by a second check
-- anywhere in application code.
--
-- Deliberately NOT built here, as a genuine, explicitly-recorded design
-- decision rather than an oversight: a new "Access Profile" table
-- sitting between user_roles and roles (the task's own "assess... team-
-- based vs resource-based scope" framing). That is a real, separate
-- architectural decision (does an Access Profile bundle roles, or
-- permissions directly; is it global, team-scoped, or resource-scoped;
-- how does it interact with user_roles' own historical-grant-record
-- shape) with more than one defensible answer, exactly the kind of
-- decision this program's own instructions say should not be silently
-- inferred. See docs/AUTHORIZATION_MODEL.md for the recorded design
-- options and the trigger for revisiting.
--
-- Scoped to the three Customer Lifecycle domains this program's
-- Maker/Checker examples actually concern (Customer Onboarding, Customer
-- Change, Commercial Configuration): Settings/Administration actions
-- (Reference Master, Team, User Access) are governed separately and are
-- not "drafts" in the Maker/Checker sense the task describes.
--
-- This file has not been applied to any database as of authoring.

insert into roles (code, name, description) values
  ('maker', 'Maker', 'Can create and edit Customer Onboarding cases, Customer Change Requests, and Commercial Configuration Versions, and submit them for review. No approval capability.'),
  ('checker', 'Checker', 'Every Maker capability, plus approval authority for Customer Onboarding, Customer Change Requests, and Commercial Configuration Versions.')
on conflict (code) do nothing;

-- Maker: create/edit/submit only, matching every existing "requester-side"
-- permission this codebase already enforces (customer.create for Onboarding,
-- customer.change_request for Customer Change, commercial_configuration.write
-- for Commercial Version), never a new permission of its own.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'maker'
  and (
    (p.resource = 'customer' and p.action in ('create', 'change_request'))
    or (p.resource = 'commercial_configuration' and p.action = 'write')
  )
on conflict (role_id, permission_id) where revoked_at is null do nothing;

-- Checker: the exact same maker-side permissions, plus each domain's
-- existing "reviewer-side" approve permission (customer.approve gates
-- Onboarding approval, Customer Change approval, AND send-back today;
-- commercial_configuration.approve gates Commercial Version approval/
-- reject), never a new, parallel "checker" permission.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code = 'checker'
  and (
    (p.resource = 'customer' and p.action in ('create', 'change_request', 'approve'))
    or (p.resource = 'commercial_configuration' and p.action in ('write', 'approve'))
  )
on conflict (role_id, permission_id) where revoked_at is null do nothing;
