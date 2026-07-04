export const indexSchema = `
create table if not exists source_files (
  id text primary key,
  path text not null unique,
  content_hash text not null,
  size integer not null,
  last_modified_at text not null,
  file_kind text not null,
  title text not null,
  detected_lang text not null,
  updated_at text not null
);

create table if not exists assets (
  id text primary key,
  source_file_id text not null,
  type text not null,
  name text not null,
  display_name text not null,
  source_path text not null unique,
  source_root text not null,
  original_description text not null,
  chinese_description text not null default '',
  content_hash text not null,
  tags_json text not null default '[]',
  project_name text,
  version text,
  last_modified_at text not null,
  discovered_at text not null,
  updated_at text not null,
  translation_status text not null,
  favorite integer not null default 0,
  risk_level text not null default 'none',
  foreign key(source_file_id) references source_files(id)
);

create table if not exists categories (
  id text primary key,
  name text not null unique,
  created_at text not null
);

create table if not exists asset_categories (
  asset_id text not null,
  category_id text not null,
  primary key(asset_id, category_id)
);

create table if not exists scan_roots (
  id text primary key,
  label text not null,
  path_expression text not null,
  expanded_path text not null,
  kind text not null,
  enabled integer not null
);

create table if not exists scan_runs (
  id text primary key,
  started_at text not null,
  finished_at text,
  scanned_roots integer not null default 0,
  created integer not null default 0,
  updated integer not null default 0,
  unchanged integer not null default 0,
  removed integer not null default 0,
  failed integer not null default 0
);

create table if not exists scan_events (
  id text primary key,
  run_id text not null,
  level text not null,
  message text not null,
  source_path text,
  created_at text not null
);

create table if not exists risk_findings (
  id text primary key,
  asset_id text not null,
  finding_type text not null,
  file_path text not null,
  line_number integer,
  severity text not null,
  created_at text not null
);
`;

export const translationSchema = `
create table if not exists translation_records (
  id text primary key,
  source_hash text not null,
  source_lang text not null,
  target_lang text not null,
  scope text not null,
  source_text text not null,
  translated_text text not null,
  provider text not null,
  created_at text not null,
  updated_at text not null,
  unique(source_hash, target_lang, scope)
);

create table if not exists translation_jobs (
  id text primary key,
  asset_id text not null,
  source_hash text not null,
  status text not null,
  error text,
  created_at text not null,
  updated_at text not null
);
`;
