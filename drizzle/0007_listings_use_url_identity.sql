-- A listing is identified by its normalized canonical URL, not its host.
-- This allows different accounts on one social platform to rank separately.
DROP INDEX IF EXISTS "listings_domain_unique";
