-- Batch 22 (Q-019, real defect found and fixed): uploadOnboardingDocument
-- and uploadGoLiveDocument each supersede-then-insert as two separate,
-- non-atomic statements (UPDATE ... SET is_current = false, then a
-- plain INSERT with is_current defaulting true). Two uploads of the
-- same document_type on the same request racing against each other can
-- interleave so that both UPDATEs run before either INSERT (the second
-- UPDATE affects zero rows, since the first already flipped the only
-- true row), leaving both new rows is_current = true at once. This is
-- not theoretical: querying the live database found four real
-- (request_id, document_type) groups already in this exact state,
-- produced by earlier rapid/duplicate-action test executions in this
-- same program. This violates this table's own stated invariant (only
-- one is_current = true row per request_id/document_type at a time,
-- docs/NEXUS_JOURNEY_UNIVERSE.md Q-019).
--
-- Fix: (1) repair the existing corrupted rows, keeping the most
-- recently uploaded row per group as current (the same outcome a
-- non-racing upload would have produced) and (2) add a partial unique
-- index on both this table and its Go Live sibling (go_live_documents,
-- an immediate-neighbour check: same upload/supersede pattern, found
-- clean today but equally exposed) so a future race fails the losing
-- INSERT with a constraint violation instead of silently corrupting
-- data. A failed INSERT is an acceptable, expected outcome per Q-019's
-- own Recovery/Resilience Variant ("either user can re-upload again to
-- correct an unwanted ordering outcome"); silent dual-current is not.

-- 1. Data repair: customer_onboarding_documents
with ranked as (
  select document_id,
         row_number() over (
           partition by request_id, document_type
           order by uploaded_at desc, document_id desc
         ) as rn
  from customer_onboarding_documents
  where is_current = true
)
update customer_onboarding_documents d
set is_current = false
from ranked r
where d.document_id = r.document_id
  and r.rn > 1;

-- 2. Prevention: at most one is_current = true row per (request_id, document_type).
create unique index idx_customer_onboarding_documents_one_current
  on customer_onboarding_documents (request_id, document_type)
  where is_current;

-- 3. Immediate-neighbour check: go_live_documents shares the identical
-- upload/supersede pattern (src/features/go-live/services/documents.service.ts).
-- No existing violation was found there, but the same race is equally
-- possible without this constraint.
create unique index idx_go_live_documents_one_current
  on go_live_documents (go_live_request_id, document_type)
  where is_current;
