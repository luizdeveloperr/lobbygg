-- Migration: Create Reviews Table (Corrected)

-- 1. Create the reviews table
-- Changed user_id to text because users.id is text (Discord ID)
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  server_id uuid references public.servers(id) on delete cascade not null,
  user_id text references public.users(id) on delete cascade not null,
  rating integer check (rating >= 1 and rating <= 5) not null,
  comment text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Constraint to ensure one review per user per server
  unique(server_id, user_id)
);

-- 2. Enable Row Level Security
alter table public.reviews enable row level security;

-- 3. Create RLS Policies

-- Policy: Anyone can view reviews
create policy "Reviews are viewable by everyone"
  on public.reviews for select
  using ( true );

-- Policy: Authenticated users can insert their own reviews
-- Note: auth.uid() returns uuid, but our user_id is text (Discord ID). 
-- If you are using Supabase Auth with custom user table linking, you might need to adjust this check.
-- Assuming the application handles the auth check via API logic primarily, but for RLS:
-- If your auth.uid() IS the discord ID (as string), we cast it. 
-- If auth.uid() is a separate UUID from auth.users, and public.users.id is the discord ID, this policy might be tricky.
-- However, typically in this setup, we trust the API or if using Supabase Auth directly where ID is UUID, then users table should have been UUID.
-- Given the error, public.users.id is TEXT.
-- Let's try a generic policy or rely on the API for write security if RLS is complex here.
-- Ideally:
-- create policy "Users can insert their own reviews"
--   on public.reviews for insert
--   with check ( auth.uid()::text = user_id ); 

-- For now, let's keep it simple and assume the API handles the primary validation, 
-- but we'll add a basic check casting auth.uid() to text just in case they match.
create policy "Users can insert their own reviews"
  on public.reviews for insert
  with check ( auth.uid()::text = user_id );

-- Policy: Users can delete their own reviews
create policy "Users can delete their own reviews"
  on public.reviews for delete
  using ( auth.uid()::text = user_id );

-- 4. Create Index for performance
create index if not exists reviews_server_id_idx on public.reviews(server_id);
