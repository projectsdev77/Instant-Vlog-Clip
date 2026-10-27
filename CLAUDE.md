# Working on this project

## Who does what
- The person working in this repo is the **developer**, not the owner of the paid accounts. They build and test on **free plans** (Supabase free, ElevenLabs free, Gemini free tier, Stripe test mode).
- The **client** sets up and pays for everything paid: plan upgrades (Supabase Pro, ElevenLabs paid plan, paid AI provider), Stripe live mode, domains, legal review.
- Never ask the developer to upgrade or pay for anything. Design and test within free-plan limits, and put every paid or production-only step in [docs/GO_LIVE.md](docs/GO_LIVE.md) for the client.

## House rules
- Never mention internal services or setup (Supabase, ElevenLabs, Gemini, keys, deploys) in anything users see.
- Never put API keys in `VITE_` variables, and never ask for keys to be pasted into chat.
- One thing at a time; ask when something isn't clear.
- Keep new UI consistent with the rest of the site's design.
- Tests: run the checks for what changed (unit tests, the affected e2e suite), not the whole e2e set after every change. See [docs/TESTING.md](docs/TESTING.md).
