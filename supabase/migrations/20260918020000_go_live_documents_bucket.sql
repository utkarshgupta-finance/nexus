-- Nexus: Go Live + Entitlement Ledger, Phase C. Private Storage bucket
-- for Go Live customer confirmation evidence, matching
-- customer-onboarding-documents' exact established pattern: no RLS
-- policy for anon/authenticated (every read/write is mediated by a
-- Server Action using the service_role client), service_role bypasses
-- RLS entirely.
--
-- This file has not been applied to any database as of authoring.

insert into storage.buckets (id, name, public)
values ('go-live-documents', 'go-live-documents', false)
on conflict (id) do nothing;
