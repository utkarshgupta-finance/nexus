-- Nexus: Platform Operating Expansion, permanent Actor Identity rule.
--
-- app_users has held no profile fields at all until now (its own
-- comment: "Holds no roles, permissions, or other profile fields").
-- Every actor-facing display in the app ("Approved by X, 14 Sep 2026")
-- has had no real human name to show, only a live Supabase Auth email
-- lookup (src/platform/audit/data/actor-directory.data.ts). This adds
-- the one real, admin-settable display_name column the new User Access
-- module (task Phase J) needs, and every actor display resolver
-- (resolveActorLabels) now prefers.
--
-- This file has not been applied to any database as of authoring.

alter table app_users add column display_name text;

comment on table app_users is
  'Application profile, 1:1 with auth.users. id is the same UUID as auth.users.id. '
  'is_active is the Nexus identity lifecycle flag (offboarding), not a status field '
  'for any business record. display_name is the one real profile field (task Phase J, '
  'User Access): an admin-maintained human name, never inferred permanently from '
  'email. Roles/permissions remain elsewhere (user_roles, role_permissions).';

comment on column app_users.display_name is
  'Admin-maintained human name (User Access module, task Phase J). Null until an '
  'admin sets one; every actor display resolver falls back to the Supabase Auth '
  'email for a user with no display_name set (never fabricated).';
