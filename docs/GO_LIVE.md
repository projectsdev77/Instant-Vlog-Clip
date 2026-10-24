# Going live

Everything outside the code that has to happen before real users and real money. Do it in this order; each step says where.

## 0. Accounts the client should own

Create these under the client's company email (not a developer's), then invite developers:

| Service | Used for |
| --- | --- |
| Supabase | Database, sign-in, server functions |
| Vercel | Hosting the web app |
| Stripe | Payments |
| Google Cloud (Gemini API) | AI: clip analysis, scripts, edit plans |
| ElevenLabs | AI voices and speech-to-text |
| Google Cloud (OAuth) | "Continue with Google" sign-in (optional) |
| A domain registrar | The site's address |

## 1. Business decisions (placeholders today)

All in [`supabase/functions/_shared/plans.ts`](../supabase/functions/_shared/plans.ts):

| Decision | Placeholder |
| --- | --- |
| Pro price | $9.99 a month, $79 a year |
| Free trial | 7 days, first subscription only |
| Free limits | 1 vlog as a guest; signed in: 3 vlogs and 20 AI edits a day |
| Pro limits | 30 vlogs and 300 AI edits a day |

The app only *shows* these prices; Stripe charges whatever its prices say, so change both together. Limits can also be changed without a deploy with the Supabase secrets `FREE_GENERATIONS_PER_DAY`, `FREE_REVISIONS_PER_DAY`, `PRO_GENERATIONS_PER_DAY`, `PRO_REVISIONS_PER_DAY`, `GUEST_GENERATIONS_TOTAL`, `GUEST_REVISIONS_TOTAL`.

## 2. AI providers on paid plans

- **Gemini**: turn on billing for the API key's Google Cloud project. The free tier is slow (1 to 2 minutes per request in our tests) and Google's terms let it use free-tier content to improve its products; the paid tier doesn't. Check the current [Gemini API terms](https://ai.google.dev/gemini-api/terms) and [pricing](https://ai.google.dev/pricing). With billing on, try `GEMINI_MODEL=gemini-flash-latest` for better scripts and plans.
- **ElevenLabs**: a paid plan (Starter or above). The free tier is for non-commercial use and ElevenLabs blocks free-tier calls from servers ("unusual activity"). Check [pricing](https://elevenlabs.io/pricing).
- Listen to the eight voices in the app; swap any in [`contracts.ts`](../supabase/functions/_shared/contracts.ts) (`ELEVENLABS_VOICE_IDS`).

**What one vlog uses**, to estimate cost with current prices:

| Call | How many | Size |
| --- | --- | --- |
| Clip analysis (Gemini) | 1 per clip | one image (contact sheet) + short text |
| Write / polish script (Gemini) | 0–2 | text in, about 100 words out |
| Plan the edit (Gemini) | 1–2, plus 1 per "Tell the AI" | a few thousand tokens of text |
| AI voice (ElevenLabs) | 1 per line | the script: about 400 characters for 30 s |
| Speech-to-text (ElevenLabs) | 1 per recorded take or talking clip | seconds of audio |

Each call's model and duration are in the `ai` function logs (Supabase → Edge Functions → ai → Logs).

## 3. Supabase

1. **Database**: `supabase link --project-ref <ref>` then `supabase db push` (creates `ai_usage` and `subscriptions`).
2. **Functions**:
   ```
   supabase functions deploy ai
   supabase functions deploy account
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
3. **Secrets** (Edge Functions → Secrets, or `supabase secrets set`):
   `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `ALLOWED_ORIGIN=https://<your domain>`, the Stripe ones from step 4. Make sure `QUOTAS_DISABLED` is **not** set.
4. **Auth → URL configuration**: Site URL `https://<your domain>`; add `https://<your domain>/**` to Redirect URLs (sign-in links return to the page the user was on).
5. **Auth → Emails**: set up custom SMTP (Supabase's built-in sender is rate-limited and meant for testing), then edit the Magic Link template with the app's name and tone.
6. **Google sign-in** (optional): create an OAuth client in Google Cloud, add it under Auth → Providers → Google, set `VITE_AUTH_GOOGLE=true` in Vercel. Google reviews the consent screen before it shows your app name to everyone; start this early.

## 4. Stripe

Full click-by-click steps, with the tests to run and the billing settings that matter: [SETUP_GUIDE.md, Part 1](SETUP_GUIDE.md#part-1-stripe). In short: do it all in a sandbox (test mode) first, run the whole flow, then repeat in live mode.

1. **Product**: "Instant Vlog Clip Pro" with two recurring prices matching `PRICING` (monthly and yearly). Copy the two price IDs (`price_…`).
2. **Customer portal** (Settings → Billing → Customer portal): allow updating payment methods, viewing invoices, cancelling (at period end), and switching between the monthly and yearly prices.
3. **Webhook** (Developers → Webhooks → Add endpoint):
   URL `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`, events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret (`whsec_…`).
4. **Secrets** in Supabase: `STRIPE_SECRET_KEY` (`sk_test_…`, later `sk_live_…`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`.
5. **Test**: sign in, Plans → Start free trial, pay with card `4242 4242 4242 4242`; Account should show "Free trial until …" within seconds. Then Manage billing → cancel; Account shows "Pro until …". Check the webhook's delivery log in Stripe if something doesn't update.
6. **Tax and receipts**: decide on Stripe Tax and turn on email receipts (Settings → Emails).

## 5. Vercel and the domain

- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public values), optionally `VITE_AUTH_GOOGLE=true`.
- Add the domain; set `ALLOWED_ORIGIN` (step 3) to exactly that origin.

## 6. Legal

- Fill every `[bracketed]` placeholder in [`src/features/account/LegalPages.tsx`](../src/features/account/LegalPages.tsx) (company, contact, minimum age, refund policy, jurisdiction, data regions).
- Have a lawyer review the Terms and Privacy Policy, then set `LEGAL_REVIEWED = true` in that file to remove the draft banner.
- If you add analytics or error monitoring, add them to the Privacy Policy (and a cookie notice where required).

## 7. Music

The built-in tracks are generated by the app (original, nothing to license). To ship real tracks, use music you have written rights to bundle and to use in users' exported videos (commissioned, or individually checked CC0), put the files in `public/music` and set each track's `url` in [`musicTracks.ts`](../src/render/musicTracks.ts). Keep a record of each track's licence.

## 8. Before announcing

- Run the [test plan](https://claude.ai/artifact/BokNGEvpTu2Ddgcp39YCkz) with the live keys on a real iPhone and Android phone, plus Chrome, Safari and Edge on a computer.
- `npm run test:all` passes ([TESTING.md](TESTING.md)).
- Do one real purchase in live mode with your own card, then refund it in Stripe.
