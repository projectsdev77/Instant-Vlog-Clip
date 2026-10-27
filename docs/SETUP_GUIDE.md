# Setup guide: Stripe, and everything else still to set up

Part 1 sets up payments in Stripe, first with fake money, then for real. Part 2 lists everything else that isn't set up yet, in the order to do it. The short version for launch day is [GO_LIVE.md](GO_LIVE.md).

Stripe and Google rename their menus now and then. If a menu isn't where this guide says, search for its name in the dashboard's search box.

---

## Part 1: Stripe

### How payments work in this app

1. A signed-in user taps **Start 7-day free trial** on the Plans page.
2. The app's `account` server function asks Stripe for a payment page (Stripe Checkout) and sends the user there. They enter a card. Nothing is charged during the trial.
3. Stripe sends the result to the `stripe-webhook` server function, which records the subscription in the `subscriptions` table. The user's limits go up straight away.
4. **Manage billing** in Settings → Plan & usage opens Stripe's own billing page (the customer portal), where they change card, switch monthly/yearly, see invoices or cancel.
5. Every later change (renewal, failed payment, cancel) reaches the app the same way, through the webhook.

The app never sees card details. Prices are set in Stripe; the app only displays them (from [`plans.ts`](../supabase/functions/_shared/plans.ts)), so keep the two the same.

### Step 1: Create the Stripe account

1. Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register) with the **client's** business email. The account should belong to the business, not a developer; invite developers later under Settings → Team.
2. You can test straight away. Real payments need the account activated (Step 10).

### Step 2: Work in a sandbox

At the top left, open the account menu and choose **Switch to sandbox** (older accounts have a **Test mode** toggle instead). A sandbox uses fake money and fake cards. Everything in Steps 3–8 happens there; Step 10 repeats it for real.

Keys made in a sandbox start with `sk_test_`; live keys start with `sk_live_`.

### Step 3: Business details and look

- **Settings → Business → Public details**: business name, support email, website (your Vercel address for now). Customers see these on receipts and card statements.
- **Settings → Branding**: logo, icon and accent colour (Ember orange is `#FF5A1F`). The payment page and emails use them.

### Step 4: Create the Pro product and its two prices

1. **Product catalog → Create product** (or **Add product**).
2. Name: `Instant Vlog Clip Pro`. Description (optional): `30 vlogs and 300 AI edits a day`.
3. First price: **Recurring**, **$9.99**, billing period **Monthly**.
4. Click **Add another price**: **Recurring**, **$79**, **Yearly**.
5. Don't add a free trial here. The app adds the 7-day trial itself, and only to someone's first subscription.
6. Save. Open each price and copy its **price ID** (`price_…`). Note which is monthly and which is yearly.

### Step 5: Set up the customer portal (Manage billing)

**Settings → Billing → Customer portal**:

- Turn on: **Payment methods** (update card), **Invoice history**, **Cancel subscriptions** → cancel **at end of billing period**, and **Switch plan** (or "Subscriptions → Customers can switch plans"). Add the Pro product with both prices, so people can move between monthly and yearly.
- **Business information**: link the Terms (`https://<your site>/terms`) and Privacy Policy (`https://<your site>/privacy`).
- Click **Save**. Manage billing gives an error until the portal has been saved once.

### Step 6: Add the webhook

This is how Stripe tells the app about payments.

1. Go to **Developers → Webhooks**. On newer accounts that's **Workbench → Webhooks**. Click **Add endpoint**, or **Create an event destination**.
2. If asked which events: **Your account**.
3. If asked for the payload type, choose **Snapshot**, not "Thin". The app expects the full event. Leave the API version at the default.
4. Pick these four events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. If asked for a destination type, choose **Webhook endpoint**. URL:
   ```
   https://tywkwrxgmwmenaqmaios.supabase.co/functions/v1/stripe-webhook
   ```
6. Create it, then **Reveal** the **signing secret** (`whsec_…`) and copy it.

### Step 7: Billing settings that matter

**Settings → Billing → Subscriptions and emails** (sometimes split into "Subscriptions" and "Customer emails"):

- **Failed payments**: turn on Smart Retries. Under *If all retries for a payment fail*, choose **Cancel the subscription**. The app keeps Pro while Stripe is retrying a card (the "past due" state). Cancelling at the end moves the user back to Free; any other choice leaves them on Pro.
- **Free trial messaging**: turn on **Send a reminder email before a free trial ends**, with the link to a Stripe-hosted page. Card networks and some countries expect a reminder before a trial turns into a charge.
- **Customer emails**: turn on emails for **successful payments** and **refunds**.

**Settings → Payment methods**: cards are on by default. Turn on Apple Pay and Google Pay too; they show automatically on phones.

**Tax**: whether you must charge sales tax or VAT depends on where the business and its customers are. Ask an accountant; Stripe Tax (**Settings → Tax**) can work it out and add it.

### Step 8: Give the keys to the server

1. **Developers → API keys**: reveal the **Secret key** (`sk_test_…`) and copy it.
2. In Supabase: **Edge Functions → Secrets → Add new secret**. Add all four:

   | Name | Value |
   | --- | --- |
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` from Step 6 |
   | `STRIPE_PRICE_MONTHLY` | the $9.99 price ID |
   | `STRIPE_PRICE_YEARLY` | the $79 price ID |

3. They apply straight away; no redeploy is needed. Never put these in Vercel or in a `VITE_` variable, and don't paste them into chats or emails.

Make sure the database and functions are up to date first (Part 2, step B).

### Step 9: Test it

Sign in to the app on your Vercel site and work through these checks. Card for everything: `4242 4242 4242 4242`, any future expiry date, any CVC, any postcode.

| # | Do | Expect |
| --- | --- | --- |
| 1 | Open **Account** | "Free plan", a **See Pro** button, no "Payments aren't switched on yet" (if it shows, a secret is missing or misspelled) |
| 2 | **Plans → Yearly → Start 7-day free trial**, pay with the test card | Back on Account within about 20 s: **Pro**, "Free trial until …, then yearly billing starts" |
| 3 | Make a few vlogs | Account's usage bars count against 30 a day, not 3 |
| 4 | **Manage billing → switch to monthly** | Back on Account: billed monthly |
| 5 | **Manage billing → Cancel** | "Pro until …, then back to Free" |
| 6 | **Manage billing → Renew** (undo the cancel) | Back to "Renews …" or the trial line |
| 7 | **Plans** page | Shows "You're on Pro · manage", not a trial button |
| 8 | In Stripe: **Customers → the customer → the subscription → Cancel immediately** | Account shows **Free** again; Plans now says **Go Pro** (no second trial) |
| 9 | Use a second test account, start the trial with card `4000 0000 0000 0341` | Checkout accepts it (nothing is charged during a trial); the first charge after the trial will fail, which is how "past due" happens |
| 10 | **Account → Delete account** on a Pro test account | Signed out; in Stripe the customer is gone and the subscription cancelled |

**If Account doesn't change:**
- In Stripe, open the webhook and look at its **deliveries/events**. A red one shows the error: "Bad signature" means `STRIPE_WEBHOOK_SECRET` is wrong. 503 means a Stripe secret is missing.
- Check Supabase → **Edge Functions → stripe-webhook → Logs** (and `account` → Logs).
- Check Supabase → **Table Editor → subscriptions**: one row per user who has paid.

**Seeing the end of a trial without waiting 7 days:** in Stripe, open the subscription. Some dashboards offer **Actions → End trial now**, or **Update subscription** with the trial end set to today. Otherwise, use **test clocks** (Billing → Subscriptions → Test clocks / simulations), which move a test customer's time forward.

Test emails: in a sandbox, Stripe only sends customer emails to addresses that belong to your Stripe team.

### Step 10: Go live

Do this once Step 9 passes and the legal pages are final (Part 2, step G).

1. **Activate the account**: at the top of the dashboard, **Activate payments** (or Settings → Business). Stripe asks for the business type, owner details, ID and the bank account for payouts. It can take a day to approve.
2. Leave the sandbox (account menu → your live account).
3. Repeat Steps 3–7 in live mode. Sandbox products, the portal, the webhook and billing settings aren't copied over. Some product pages have a **Copy to live mode** button.
4. In Supabase, replace the four secrets with the **live** values: `sk_live_…`, the live webhook's `whsec_…`, and the live price IDs.
5. Buy Pro once with your own real card, check Settings → Plan & usage, then refund yourself in Stripe (**Payments → the payment → Refund**) and cancel the subscription.

---

## Part 2: Everything else still to set up

| | What | Status | Needed for |
| --- | --- | --- | --- |
| A | Vercel hosting | You're doing it now | Testing on a real address |
| B | Database update + deploy 3 functions | Not done | Plans and account pages |
| C | Supabase sign-in addresses | Not done | Sign-in links returning to your site |
| D | Stripe | Part 1 | Payments |
| E | Email sender (SMTP) | Not done | More than a few sign-ins an hour |
| F | Paid AI plans | Not done | Speed, commercial use |
| G | Legal pages | Drafts | Launch |
| H | Custom domain | Not done | Launch, Google sign-in |
| I | Google sign-in | Optional | Easier sign-in |
| J | Lock the server to your site (`ALLOWED_ORIGIN`) | Not done | Launch |
| K | Music | Generated placeholders | Optional |
| L | AI voices (add 20 to ElevenLabs) | Built-in voices, retiring Dec 31, 2026 | AI voices keep working after 2026; more accents |

### A. Vercel

Import the GitHub repo in Vercel and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables, plus `VITE_AUTH_GOOGLE=false` until Google sign-in is set up (I). Every push to the branch updates the site.

### B. Database and functions

In the project folder (PowerShell):
```
supabase link --project-ref tywkwrxgmwmenaqmaios
supabase db push
supabase functions deploy ai
supabase functions deploy account
supabase functions deploy stripe-webhook --no-verify-jwt
```
`db push` should list `20261023000000_subscriptions.sql` and `20261027000000_vlog_storage.sql` (the `vlogs` table, the private `vlogs` storage bucket and the account-space check). Redeploy the functions whenever the code under `supabase/functions` changes; the app shows "AI function is out of date" if `ai` is behind.

**Account storage works on the free Supabase plan** (about 1 GB of files, 50 MB per file). Each user's space is set in the `storage_limits` table (Table Editor): Free 2 GB and Pro 50 GB by default. To try the "space full" message while testing, set the `free` row to a small number such as `20000000` (20 MB), then back. To check it worked: sign in, make a vlog, then open **Table Editor → vlogs** (one row) and **Storage → vlogs** (a folder with your user id holding the voice files, and `video.mp4` after an export).

### C. Supabase sign-in addresses

**Authentication → URL Configuration**:
- **Site URL**: your Vercel address (later your domain).
- **Redirect URLs**: `https://<your Vercel address>/**` and `http://localhost:5173/**`.

**Email and password sign-up.** In **Authentication → Sign In / Providers → Email**:
- **Enable Email provider**: on.
- **Confirm email**: on (new accounts get a confirmation link and can log in after clicking it).
- **Minimum password length**: `8`.
- **Password requirements**: **Lowercase, uppercase letters, digits and symbols** (the app asks for 8+ characters with an uppercase letter, a number and a special character; this makes the server check it too).
- Save.

The confirmation and "reset your password" emails use Supabase's standard templates (a link); they work without an email service. The reset link opens `/reset-password` on the site, which the Redirect URLs above already allow. Supabase's built-in sender only sends a few emails an hour, and only to members of your Supabase team, so space out tests or use Google.

### D. Stripe

Part 1 above.

### E. Email sender

Supabase's built-in sender only sends a few emails an hour and is meant for testing; real users will hit "rate limit exceeded".

1. Sign up with an email service (for example Resend, Postmark, SendGrid or Amazon SES) and verify the sending domain. That needs your own domain (H).
2. In Supabase, go to **Authentication → Emails → SMTP Settings**, turn on custom SMTP and enter the service's host, port, user and password. Use a sender like `hello@yourdomain.com`.
3. Raise the email rate limit under **Authentication → Rate Limits** if needed.

### F. Paid AI plans

- **Gemini**: in Google AI Studio or Google Cloud, turn on billing for the project that owns `GEMINI_API_KEY`. The free tier is slow and Google may use free-tier content to improve its products. Once billing is on, consider the Supabase secret `GEMINI_MODEL=gemini-flash-latest` for better scripts.
- **ElevenLabs**: upgrade to a paid plan (Starter or above). The free tier doesn't allow commercial use and is often blocked from servers.
- Set a monthly spending limit or budget alert in both, so a bug or abuse can't run up a bill.

### G. Legal

1. Fill every `[bracketed]` part in [`src/features/account/LegalPages.tsx`](../src/features/account/LegalPages.tsx): company name, contact email, the date, minimum age (13 or 16), refund policy, governing law, and where data is processed.
2. Have a lawyer review the Terms and Privacy Policy. Mention the AI services, payments and that videos stay on the device.
3. Set `LEGAL_REVIEWED = true` in the same file to remove the "draft" banner.

### H. Custom domain

1. Buy the domain (any registrar).
2. In Vercel: **Settings → Domains → Add**, then follow its instructions for the DNS records.
3. Then update everything that names the address:
   - Supabase **Site URL** and **Redirect URLs** (C).
   - `ALLOWED_ORIGIN` (J).
   - Stripe public details, portal links and branding (Part 1, Steps 3 and 5).
   - Google sign-in origins (I).

### I. Google sign-in

1. [console.cloud.google.com](https://console.cloud.google.com): create or pick a project.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name, support email, developer email, and the app's privacy and terms links.
   - Scopes: the defaults (email, profile, openid).
   - Under Test users, add yourself.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**.
   - Authorised JavaScript origins: your site address and `http://localhost:5173`.
   - Authorised redirect URI: `https://tywkwrxgmwmenaqmaios.supabase.co/auth/v1/callback`
   - Copy the Client ID and secret.
4. Supabase: **Authentication → Sign In / Providers → Google**. Turn it on and paste both.
5. Vercel: set `VITE_AUTH_GOOGLE` to `true` (or delete the variable: Google is on unless it says `false`), then **Deployments → ⋯ → Redeploy**. Locally, the same in `.env.local`.
6. To let anyone sign in (not just test users): **Google Auth Platform → Audience → Publish app → Confirm**. No review is needed, because the app only asks for name, email and profile picture.

### J. Lock the server to your site

When the final address is live, add the Supabase secret `ALLOWED_ORIGIN` = `https://yourdomain.com` (exactly, no trailing slash). After that, only your site can call the AI and account functions, and Stripe only returns people to your site. It accepts one address, so local testing against the live functions stops working. Leave it unset until launch.

### K. Music

The built-in tracks are generated by the app and are original. Users can add their own songs after confirming they have the rights. To bundle real tracks, use music with written rights for bundling and for use in users' videos (commissioned, or checked CC0). Put the files in `public/music` and set each track's `url` in [`src/render/musicTracks.ts`](../src/render/musicTracks.ts).

### L. AI voices

The app shows the voices that are in the app's ElevenLabs account (**My Voices**), up to 30, with the name, accent and description ElevenLabs gives them. Change the lineup in ElevenLabs any time; the app picks it up within 10 minutes, with no code change.

Until any voices are added, the app uses 8 built-in ElevenLabs "default" voices. **Those stop working on December 31, 2026**, and ElevenLabs accounts created after March 2026 can't use them at all, so do this before launch.

**You need a paid ElevenLabs plan** (Starter or above): Voice Library voices can't be used from the app on the free plan. Saved library voices don't use up the plan's custom voice slots, so 20 is fine on any paid plan.

**To add a voice:** open its link below while signed in to ElevenLabs, press play to hear it, and click **Add to my voices** (or **Save**). Skip any you don't like.

Picked for a warm, casual vlog sound from their descriptions (not by ear). The names are as ElevenLabs lists them; the part after the dash is what the app shows under the name. The first ten are ElevenLabs' own long-term replacements for its retiring default voices, including the closest matches to the current 8.

| # | Voice | Why | Link |
| --- | --- | --- | --- |
| 1 | Jade – Upbeat and Natural | Replaces Mia | [open](https://elevenlabs.io/app/voice-library?voiceId=g7LVvkPWALzPxOQbF6OE) |
| 2 | Caleb – Trusted Guide | Replaces Sam | [open](https://elevenlabs.io/app/voice-library?voiceId=AaOhDHYJ1XLZk74lXhdE) |
| 3 | Warren – Effortless and Cool | Replaces Will | [open](https://elevenlabs.io/app/voice-library?voiceId=7QN34D2r3hCNwbOYIeK0) |
| 4 | Baxter – Dry Calm Aussie | Replaces Charlie (Australian) | [open](https://elevenlabs.io/app/voice-library?voiceId=jSuBIjxMKhqIfb0wCK1F) |
| 5 | Talia – Warm Soft Guide | Replaces Ava | [open](https://elevenlabs.io/app/voice-library?voiceId=OZ0L6eISlOejga3XjDFt) |
| 6 | Lawrence – Bright and Informative | Replaces Liam | [open](https://elevenlabs.io/app/voice-library?voiceId=ktkP7Nsj67dw2zcplQYt) |
| 7 | Elowen – Upbeat Modern Narrator | Replaces River | [open](https://elevenlabs.io/app/voice-library?voiceId=dvbL7qkNGZY1IqPGZAjM) |
| 8 | Maisie – Friendly Casual Neighbor | Chatty, everyday | [open](https://elevenlabs.io/app/voice-library?voiceId=QtY3JBOUKEB5xzrRfOKc) |
| 9 | Eddie – Natural and Helpful | Easygoing male | [open](https://elevenlabs.io/app/voice-library?voiceId=l7kNoIfnJKPg7779LI2t) |
| 10 | Darian – Warm Grounded Storyteller | Calm, warm for slower vlogs | [open](https://elevenlabs.io/app/voice-library?voiceId=gOupLcAkjEnguROwi4oS) |
| 11 | Jessica Anne Bogart – Chatty and Friendly | Conversational female | [open](https://elevenlabs.io/app/voice-library?voiceId=g6xIsTj2HwM6VR4iXFCw) |
| 12 | Arthur – Energetic American Male Narrator | Made for TikTok and YouTube | [open](https://elevenlabs.io/app/voice-library?voiceId=TtRFBnwQdH1k01vR0hMz) |
| 13 | Alex – Upbeat, Energetic and Clear | Young American, for shorts | [open](https://elevenlabs.io/app/voice-library?voiceId=yl2ZDV1MzN4HbQJbMihG) |
| 14 | Allison – Energetic, Clear and Bubbly | Fun millennial female | [open](https://elevenlabs.io/app/voice-library?voiceId=xctasy8XvGp2cVO9HL9k) |
| 15 | Dan – Engaging Science Instructor | British male, for YouTube and TikTok | [open](https://elevenlabs.io/app/voice-library?voiceId=BHr135B5EUBtaWheVj8S) |
| 16 | Adam Stone – Smooth, Deep and Relaxed | Laid-back British male | [open](https://elevenlabs.io/app/voice-library?voiceId=NFG5qt843uXKj4pFvR7C) |
| 17 | Kade Murdock – Friendly and Polished | Young, smooth, conversational female | [open](https://elevenlabs.io/app/voice-library?voiceId=XdxYCbvu4pF876vgEQRe) |
| 18 | Hale – Smooth, Confident and Persuasive | Expressive American male | [open](https://elevenlabs.io/app/voice-library?voiceId=dXtC3XhB9GtPusIpNtQx) |
| 19 | Cassidy – Crisp Podcaster | Confident female podcaster | [open](https://elevenlabs.io/app/voice-library?voiceId=56AoDkrOh6qfVPDXZ7Pt) |
| 20 | *Your pick* | Another accent (see below) | |

**More accents:** in ElevenLabs go to **Voices → Explore** and set the filters: Language **English**, Accent (for example Irish, Scottish, Indian, South African, Nigerian, Canadian), Category **Conversational** or **Social Media**. Sort by **Most users**, play the top few and add one that sounds warm and natural. Swap any of the voices above for these.

**After adding them**, open the Voice step in the app (wait up to 10 minutes, or redeploy `ai` to refresh at once): the cards should show your voices. Tap play on a few: each preview uses a little ElevenLabs credit.

---

## Before announcing

- The [test plan](https://claude.ai/artifact/BokNGEvpTu2Ddgcp39YCkz) on a real iPhone and Android phone, and Chrome, Safari and Edge on a computer.
- `npm run test:all` passes, and the GitHub **Actions** tab is green ([TESTING.md](TESTING.md)).
- One real purchase in live mode, then a refund.
