CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL,
  email text,
  avatar_url text,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_login timestamptz
);

CREATE TABLE IF NOT EXISTS servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  name text NOT NULL,
  description text NOT NULL,
  members integer NOT NULL DEFAULT 0,
  members_online integer NOT NULL DEFAULT 0,
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  invite_link text NOT NULL,
  icon_emoji text DEFAULT '🔥',
  icon_url text,
  banner_url text,
  guild_id text,
  custom_slug text,
  rejection_reason text,
  allow_resubmission boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sponsored boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  boosts integer NOT NULL DEFAULT 0,
  boost_reminder boolean NOT NULL DEFAULT false,
  auto_boost boolean NOT NULL DEFAULT false,
  last_boost_at timestamptz,
  min_bet_value numeric(12,2),
  custom_room_value numeric(12,2)
);

CREATE UNIQUE INDEX IF NOT EXISTS servers_guild_id_unique_idx ON servers (guild_id) WHERE guild_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS servers_custom_slug_unique_idx ON servers (custom_slug) WHERE custom_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS servers_user_id_idx ON servers (user_id);
CREATE INDEX IF NOT EXISTS servers_status_idx ON servers (status);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS reviews_server_id_idx ON reviews (server_id);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  link text,
  color text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  details text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  username text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON admin_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS boost_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  server_id uuid REFERENCES servers(id) ON DELETE CASCADE,
  guild_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS boost_logs_server_id_idx ON boost_logs (server_id);
CREATE INDEX IF NOT EXISTS boost_logs_user_id_idx ON boost_logs (user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc', now());
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login timestamptz;

ALTER TABLE servers ADD COLUMN IF NOT EXISTS members integer NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS members_online integer NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE servers ADD COLUMN IF NOT EXISTS icon_emoji text DEFAULT '🔥';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS guild_id text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS custom_slug text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS allow_resubmission boolean NOT NULL DEFAULT true;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS sponsored boolean NOT NULL DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS boosts integer NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS boost_reminder boolean NOT NULL DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS auto_boost boolean NOT NULL DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_boost_at timestamptz;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS min_bet_value numeric(12,2);
ALTER TABLE servers ADD COLUMN IF NOT EXISTS custom_room_value numeric(12,2);
