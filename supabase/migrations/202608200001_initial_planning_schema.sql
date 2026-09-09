create extension if not exists pgcrypto;

create type public.member_role as enum ('admin', 'management', 'vertical_owner', 'viewer');
create type public.plan_status as enum ('draft', 'approved', 'archived');
create type public.scope_type as enum ('organization', 'vertical', 'product', 'market', 'client');
create type public.cost_frequency as enum ('monthly', 'one_off');
create type public.forecast_run_status as enum ('queued', 'running', 'completed', 'failed');
create type public.import_status as enum ('uploaded', 'parsed', 'validated', 'rejected', 'imported');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reporting_currency text not null default 'USD',
  forecast_start_month date not null,
  horizon_months integer not null default 36 check (horizon_months > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table public.verticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  color_token text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.vertical_members (
  vertical_id uuid not null references public.verticals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vertical_id, profile_id)
);

create table public.currencies (
  code text primary key check (char_length(code) = 3),
  name text not null,
  decimals smallint not null default 2
);

create table public.countries (
  code text primary key check (char_length(code) = 2),
  name text not null,
  currency_code text not null references public.currencies(code)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vertical_id uuid not null references public.verticals(id),
  code text not null,
  name text not null,
  economic_model_key text not null,
  status text not null default 'draft',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.product_markets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  country_code text not null references public.countries(code),
  status text not null default 'planned',
  local_currency_code text not null references public.currencies(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, country_code)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'planned',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_clients (
  id uuid primary key default gen_random_uuid(),
  product_market_id uuid not null references public.product_markets(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  unique (product_market_id, client_id)
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_scenario_id uuid references public.scenarios(id),
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  version_number integer not null,
  status public.plan_status not null default 'draft',
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (scenario_id, version_number)
);

create table public.growth_curves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  metric_key text not null,
  unit text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.growth_curve_points (
  growth_curve_id uuid not null references public.growth_curves(id) on delete cascade,
  month_since_go_live integer not null check (month_since_go_live >= 0),
  value numeric not null,
  primary key (growth_curve_id, month_since_go_live)
);

create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  product_market_id uuid not null references public.product_markets(id) on delete cascade,
  product_client_id uuid references public.product_clients(id) on delete cascade,
  growth_curve_id uuid references public.growth_curves(id),
  go_live_date date not null,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  driver_type text not null,
  unit text not null,
  aggregation_method text not null default 'sum',
  minimum_value numeric,
  maximum_value numeric,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.assumption_series (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  driver_definition_id uuid not null references public.driver_definitions(id),
  scope public.scope_type not null,
  vertical_id uuid references public.verticals(id),
  product_id uuid references public.products(id),
  product_market_id uuid references public.product_markets(id),
  client_id uuid references public.clients(id),
  start_month date,
  end_month date,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_trunc('month', start_month) = start_month or start_month is null),
  check (date_trunc('month', end_month) = end_month or end_month is null)
);

create table public.assumption_points (
  assumption_series_id uuid not null references public.assumption_series(id) on delete cascade,
  period_month date not null,
  numeric_value numeric not null,
  currency_code text references public.currencies(code),
  primary key (assumption_series_id, period_month),
  check (date_trunc('month', period_month) = period_month)
);

create table public.scenario_overrides (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  entity_table text not null,
  entity_id uuid not null,
  field_name text not null,
  numeric_value numeric,
  text_value text,
  date_value date,
  created_at timestamptz not null default now(),
  unique (scenario_id, entity_table, entity_id, field_name),
  check (num_nonnulls(numeric_value, text_value, date_value) = 1)
);

create table public.fx_assumptions (
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  period_month date not null,
  from_currency text not null references public.currencies(code),
  to_currency text not null references public.currencies(code),
  rate numeric not null check (rate > 0),
  primary key (plan_version_id, period_month, from_currency, to_currency)
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  product_market_id uuid not null references public.product_markets(id) on delete cascade,
  client_id uuid references public.clients(id),
  rule_type text not null check (rule_type in ('take_rate', 'fee_per_tx', 'monthly_fee', 'spread')),
  basis_driver_key text not null,
  value numeric not null,
  currency_code text references public.currencies(code),
  start_month date not null,
  end_month date,
  created_at timestamptz not null default now()
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.direct_cost_rules (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  product_market_id uuid not null references public.product_markets(id) on delete cascade,
  provider_id uuid references public.providers(id),
  rule_type text not null check (rule_type in ('rate', 'per_tx', 'per_user', 'per_account', 'monthly_fixed')),
  basis_driver_key text not null,
  value numeric not null,
  currency_code text references public.currencies(code),
  start_month date not null,
  end_month date,
  created_at timestamptz not null default now()
);

create table public.cost_items (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  name text not null,
  category text not null,
  scope public.scope_type not null default 'organization',
  vertical_id uuid references public.verticals(id),
  product_id uuid references public.products(id),
  currency_code text not null references public.currencies(code),
  amount numeric not null check (amount >= 0),
  frequency public.cost_frequency not null,
  start_month date not null,
  end_month date,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.headcount_plans (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  role_name text not null,
  area text not null,
  vertical_id uuid references public.verticals(id),
  start_month date not null,
  end_month date,
  quantity integer not null check (quantity > 0),
  base_salary numeric not null check (base_salary >= 0),
  benefits_rate numeric not null default 0 check (benefits_rate >= 0),
  currency_code text not null references public.currencies(code),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.marketing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  vertical_id uuid references public.verticals(id),
  product_id uuid references public.products(id),
  start_month date not null,
  end_month date,
  monthly_budget numeric not null check (monthly_budget >= 0),
  currency_code text not null references public.currencies(code),
  cac numeric check (cac > 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions(id) on delete cascade,
  start_month date not null,
  horizon_months integer not null check (horizon_months > 0),
  reporting_currency text not null references public.currencies(code),
  inputs_hash text not null,
  status public.forecast_run_status not null default 'queued',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.forecast_monthly (
  id uuid primary key default gen_random_uuid(),
  forecast_run_id uuid not null references public.forecast_runs(id) on delete cascade,
  period_month date not null,
  vertical_id uuid references public.verticals(id),
  product_id uuid references public.products(id),
  product_market_id uuid references public.product_markets(id),
  client_id uuid references public.clients(id),
  volume numeric not null default 0,
  transactions numeric not null default 0,
  active_units numeric not null default 0,
  revenue numeric not null default 0,
  direct_cost numeric not null default 0,
  contribution_margin numeric not null default 0,
  vertical_cost numeric not null default 0,
  general_cost numeric not null default 0,
  operating_result numeric not null default 0,
  net_cash_flow numeric not null default 0,
  ending_cash numeric not null default 0,
  detail jsonb not null default '{}'::jsonb
);

create index forecast_monthly_run_period_idx on public.forecast_monthly (forecast_run_id, period_month);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  vertical_code text,
  adapter_key text not null,
  status public.import_status not null default 'uploaded',
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.import_staging_rows (
  id bigint generated always as identity primary key,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text not null,
  row_number integer not null,
  canonical_payload jsonb not null,
  is_valid boolean not null default false
);

create table public.import_errors (
  id bigint generated always as identity primary key,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  sheet_name text,
  row_number integer,
  column_name text,
  severity text not null check (severity in ('warning', 'error')),
  message text not null
);

create table public.change_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scenario_id uuid references public.scenarios(id),
  changed_by uuid references public.profiles(id),
  entity_table text not null,
  entity_id uuid not null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger verticals_updated_at before update on public.verticals for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger roadmap_items_updated_at before update on public.roadmap_items for each row execute function public.set_updated_at();
create trigger assumption_series_updated_at before update on public.assumption_series for each row execute function public.set_updated_at();
create trigger cost_items_updated_at before update on public.cost_items for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.verticals enable row level security;
alter table public.products enable row level security;
alter table public.scenarios enable row level security;
alter table public.plan_versions enable row level security;

create policy "members can read organization" on public.organizations for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.profile_id = auth.uid()));

create policy "members can read verticals" on public.verticals for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = verticals.organization_id and m.profile_id = auth.uid()));

create policy "members can read products" on public.products for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = products.organization_id and m.profile_id = auth.uid()));

create policy "members can read scenarios" on public.scenarios for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = scenarios.organization_id and m.profile_id = auth.uid()));

create policy "members can read plan versions" on public.plan_versions for select to authenticated
using (exists (
  select 1 from public.scenarios s
  join public.organization_members m on m.organization_id = s.organization_id
  where s.id = plan_versions.scenario_id and m.profile_id = auth.uid()
));
