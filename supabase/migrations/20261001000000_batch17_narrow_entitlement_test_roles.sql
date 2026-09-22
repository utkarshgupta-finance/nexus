-- Batch 17 test fixtures: three narrow-permission roles needed to exercise
-- the Entitlement domain's authorization boundaries (I-013, I-025, I-026)
-- precisely, since no existing role holds exactly one of these narrower
-- permission subsets. Test-only reference data, no schema change, follows
-- the same pattern as the existing "Gap Closure Usage Read Only" role.

insert into roles (code, name, description, is_active)
values
  ('batch17_entitlement_read_only', 'Batch 17 Entitlement Read Only (test)', 'Test-only role: entitlement.read alone, for I-025 read-vs-write boundary verification.', true),
  ('batch17_usage_write_no_finalize', 'Batch 17 Usage Write, No Finalize (test)', 'Test-only role: usage.write alone (no usage.finalize), for I-013 finalize permission boundary verification.', true),
  ('batch17_entitlement_write_settlement_read', 'Batch 17 Entitlement Write, Settlement Read Only (test)', 'Test-only role: entitlement.write plus entitlement_settlement.read (no entitlement_settlement.write), for I-026 independent-permission-family verification.', true)
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on true
where (r.code = 'batch17_entitlement_read_only' and p.resource = 'entitlement' and p.action = 'read')
   or (r.code = 'batch17_usage_write_no_finalize' and p.resource = 'usage' and p.action = 'write')
   or (r.code = 'batch17_entitlement_write_settlement_read' and p.resource = 'entitlement' and p.action = 'write')
   or (r.code = 'batch17_entitlement_write_settlement_read' and p.resource = 'entitlement_settlement' and p.action = 'read')
on conflict do nothing;
