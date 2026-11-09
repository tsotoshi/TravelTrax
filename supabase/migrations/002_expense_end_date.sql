-- V1.1: hotel check-out / end date on expenses. Safe to run more than once.
alter table public.expenses add column if not exists end_date date;
