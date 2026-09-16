-- Bootstrapped by hand against the live project (no self-service grant
-- path, same as is_admin) — marks an account as one of the app's
-- original/founding members, purely identity/badge — carries no extra
-- permissions the way is_admin does.
alter table users add column is_founder boolean not null default false;
