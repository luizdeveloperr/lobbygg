-- Run this in your Supabase SQL Editor to update the table structure

ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS icon_url text;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS guild_id text;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS allow_resubmission boolean DEFAULT true;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS boosts integer DEFAULT 0;
