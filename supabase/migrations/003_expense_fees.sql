-- V1.2: taxes & fees and baggage, paid in cash and kept separate from cash and points. Safe to run more than once.
alter table public.expenses add column if not exists fees numeric(12, 2) not null default 0 check (fees >= 0);
alter table public.expenses add column if not exists baggage numeric(12, 2) not null default 0 check (baggage >= 0);
