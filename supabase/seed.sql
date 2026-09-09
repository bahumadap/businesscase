insert into public.currencies (code, name, decimals) values
  ('USD', 'US Dollar', 2), ('CLP', 'Chilean Peso', 0), ('PEN', 'Peruvian Sol', 2), ('BRL', 'Brazilian Real', 2)
on conflict do nothing;

insert into public.countries (code, name, currency_code) values
  ('CL', 'Chile', 'CLP'), ('PE', 'Perú', 'PEN'), ('BR', 'Brasil', 'BRL')
on conflict do nothing;

insert into public.organizations (id, name, reporting_currency, forecast_start_month, horizon_months)
values ('10000000-0000-0000-0000-000000000001', 'YOL1 — SAMPLE / DEMO DATA', 'USD', '2027-01-01', 36)
on conflict do nothing;

insert into public.verticals (id, organization_id, code, name, description, color_token, is_demo) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'enterprise', 'Enterprise', 'Grandes empresas y plataformas', 'enterprise', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'smb', 'SMB', 'Comercios y pequeñas empresas', 'smb', true),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'b2c', 'B2C', 'Personas y servicios de consumo', 'b2c', true)
on conflict do nothing;

insert into public.scenarios (id, organization_id, name, description, is_default) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Base', 'Escenario demo inicial', true),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Upside', 'Solo overrides respecto de Base', false),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Downside', 'Solo overrides respecto de Base', false)
on conflict do nothing;

insert into public.plan_versions (id, scenario_id, version_number, status) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'draft')
on conflict do nothing;
