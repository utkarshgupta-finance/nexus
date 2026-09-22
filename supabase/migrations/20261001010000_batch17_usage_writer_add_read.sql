-- I-013 needs the usage-write-no-finalize test persona to actually be able
-- to view the Entitlement page (the page's own AuthGate requires at least
-- one of entitlement.read/usage.read/entitlement_settlement.read), so the
-- finalize-permission-boundary rejection can be tested against the real
-- Finalize button rather than stopping at page-level access.

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.resource = 'usage' and p.action = 'read'
where r.code = 'batch17_usage_write_no_finalize'
on conflict do nothing;
