
-- Create table for servers
create table public.servers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text not null,
  members integer default 0,
  category text not null,
  tags text[] default '{}'::text[],
  invite_link text not null,
  icon_emoji text default '🔥'::text,
  icon_url text,
  banner_url text,
  guild_id text,
  rejection_reason text,
  allow_resubmission boolean default true,
  featured boolean default false,
  sponsored boolean default false,
  status text default 'pending'::text check (status in ('approved', 'pending', 'rejected')),
  user_id uuid references auth.users(id)
);

-- Enable Row Level Security (RLS)
alter table public.servers enable row level security;

-- Create policies
-- Allow everyone to read approved servers
create policy "Public servers are viewable by everyone"
  on public.servers for select
  using (true);

-- Allow authenticated users to insert their own servers
create policy "Users can insert their own servers"
  on public.servers for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own servers
create policy "Users can update their own servers"
  on public.servers for update
  using (auth.uid() = user_id);
