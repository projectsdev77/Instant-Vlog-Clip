-- One row per user who has started a checkout: their Stripe customer and the
-- state of their Pro subscription, kept current by the stripe-webhook function.
-- Only the Edge Functions (service role) read or write it.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'none',      -- Stripe subscription status, or 'none'
  plan text not null default 'free',        -- 'free' | 'pro'
  billing_interval text,                    -- 'month' | 'year'
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_used boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
-- No policies: clients can't access it; the service role bypasses RLS.
