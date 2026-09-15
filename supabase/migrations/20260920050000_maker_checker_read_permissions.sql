-- Nexus: NEXUS ACCEPTANCE CLOSURE. Fixes a real defect found while
-- testing the maker/checker flow with a genuinely different-checker
-- test user (never possible before, since every prior acceptance pass
-- self-approved as one admin-like account): a user holding only the
-- `maker` role could not even load /my-work, because
-- 20260916070000_maker_checker_roles.sql granted the write/create-side
-- permissions (customer.create/change_request, commercial_configuration
-- .write) and 20260918010000_go_live_domain.sql additively granted the
-- Go Live permissions, but neither granted the plain READ permissions
-- every page in the happy path actually checks (`customer.read` on
-- /my-work, /approvals, /reviews/*, /reviews/change-requests/*, the
-- "Change Customer" chooser, and onboarding document download;
-- `commercial_configuration.read` on a customer's Commercial tab and
-- Commercial Version review screen). A maker/checker with zero read
-- access could create nothing, since every create/approve flow starts
-- by loading a read-gated page first.
--
-- Extends the existing maker/checker roles additively, exactly the
-- established pattern from 20260918010000_go_live_domain.sql: no new
-- role, no new permission, just the two read grants both existing
-- roles were always supposed to carry.
--
-- This file has not been applied to any database as of authoring.

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.code in ('maker', 'checker')
  and (
    (p.resource = 'customer' and p.action = 'read')
    or (p.resource = 'commercial_configuration' and p.action = 'read')
  )
on conflict (role_id, permission_id) where revoked_at is null do nothing;
