# Rangach

Verified Luo business directory and classifieds. Kenya first, diaspora second. WhatsApp stays the place to chat. Rangach is for discovery, trust, and paid visibility.

**Rangach** is Dholuo for "gate, the entrance to a homestead". The tagline is "The gateway to the Luo home."

This is a clickable local prototype. Sample businesses are fictional. Featured listing and Verified Pro are paid through Flutterwave (Kenya M-Pesa and card). Until `FLW_SECRET_KEY` is set, checkout stays disabled and nothing is charged.

## Run

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm install` copies `.env.example` to `.env` when `.env` is missing, then generates the Prisma client. `npm run db:setup` applies the SQLite migration and loads the seed.

Equivalent first-time commands, if you prefer the Prisma CLI directly:

```bash
npx prisma migrate dev
npx prisma db seed
npm run dev
```

The initial migration is already in `prisma/migrations`, so `migrate dev` should only apply it. Reset the demo data with `npm run db:reset`.

## Demo accounts

Every seeded account uses the password `demo1234` on your laptop (`npm run dev`). A production deploy disables password login for `@dala.local` and removes any admin role on those accounts. Those shops and listings stay in the database and stay on public pages unless `HIDE_DEMO_SHOPS` is `1`, `true`, `yes`, or `on`. Placeholder phone and WhatsApp numbers are never shown. The sign-in page lists these addresses only in local development.

| Email | Who |
| --- | --- |
| `akinyi@dala.local` | Admin on your laptop. In production this account is a normal user and `demo1234` does not work. The live admin is `ADMIN_EMAIL`. |
| `atieno@dala.local` | Nairobi restaurant and events. |
| `okello@dala.local` | Diaspora solicitor. Already on Verified Pro. |
| `grace@dala.local` | Nairobi beauty, clinic, and fellowship. |
| `mary@dala.local` | Nairobi trades, garage, and shop. |
| `peter@dala.local` | Diaspora grocer, kitchen, and cabs. |
| `achieng@dala.local` | Nairobi resident. Tutoring and classifieds. |
| `james@dala.local` | Diaspora resident. Rooms and a flagged plot advert. |

Try the sentence search with `verified restaurants in Kenya` or `housing in the diaspora`. The high-risk plot advert and the "limited offer" sofa are there so the scam check is visible. One phone advert is already hidden for the admin queue.

## Shops

A published shop is a public page at `/b/[slug]`. It shows a banner (Verified Pro), the profile about text, a WhatsApp button, and the seller's offerings. Buyers do not need an account. There is no cart, checkout, stock count, or shipping. The WhatsApp draft names the offering and includes the shop URL. The product name in that sentence comes from `appName()` in `src/lib/brand.ts` (`Hi, I saw {offering} on your Rangach shop ({url})…`). The URL is the public origin (`APP_URL`, then `AUTH_URL`, then `NEXTAUTH_URL`, otherwise the host you are browsing).

| Shop | City | Seller | Notes |
| --- | --- | --- | --- |
| `/b/mama-atieno` | Nairobi | `atieno@dala.local` | Free. Four offerings. |
| `/b/peckham-grocer` | London | `peter@dala.local` | Free. Four offerings. |
| `/b/okello-and-co` | London | `okello@dala.local` | Verified Pro. Cover banner and four offerings. |

Sign in as the seller and open **Manage storefront** from Account, the header (**Open a shop**), or the listing edit page. Home and the header use the same labels. Signed-out visitors go to sign-in and return to shop setup or the listing form.

With no shop yet, Manage storefront shows three steps: create the shop from your profile, add a first offering, then publish. After the first offering, that page asks you to publish and shows the WhatsApp line buyers will send. From there you can change the address, write the about text, add or edit offerings, archive them, move them up or down, and publish. Unpublished shops return a not-found page to everyone except the owner, who can still preview.

Free shops list up to 5 offerings. Verified Pro (`user.verifiedPro` plus `user.verifiedProUntil`) lasts 30 days, raises that to 20, and unlocks the cover banner and shop video. Renewing before the end date adds 30 days to it. When the date passes, the extra offerings, the banner, and the video are hidden, not deleted, and they come back on renewal. The first 5 offerings in the seller's shop order stay public. On the shop and on listing cards that plan is labelled **Pro plan**, so it is not read as a verification badge. Featured listing is unchanged: it is a directory boost, separate from the shop. A "featured shop" flag is left for later.

Phone verified, Location verified, and Business verified are separate shop checks. An admin grants or removes each one from `/admin`. A grant must say how it was checked: Call, Video, Visit, or Documents seen. Documents seen means the admin looked at papers. Nothing is uploaded or stored. Every change is appended to an audit trail with the admin, the time, the method on a grant, and an optional note. The shop page shows the latest grant for each active badge, for example “Phone checked 12 Sep 2026 by call”. Paying for Verified Pro does not grant them, and granting them does not turn on Verified Pro. A fresh seed gives Mama Atieno phone (call) and location (video) checks, and the Peckham grocer a business check (documents seen). Okello & Co stays on Verified Pro with none of those checks. Seed does not add checks to a database that already has users.

Listing cards show **Shop**, and the listing page shows **Visit storefront**, when that seller's shop is published.

## Shop videos

A Pro shop can upload one MP4 or MOV, up to 45 seconds and 200 MB, including iPhone HEVC. The file goes from the phone to Mux. It does not pass through Vercel. It stays private until an admin approves it in `/admin`. A replacement stays in review while the current video remains on the shop. Approval swaps them and deletes the old Mux asset.

If Pro is turned off, or `verifiedProUntil` has passed, the video is hidden from the shop, from cards, and from link previews. The file is kept and shows again when Pro is back on. Nothing is deleted just because Pro lapsed.

A rejected upload is deleted from Mux after 14 days. The audit note and poster stay. A clip over 45 seconds is deleted immediately. Taking down a live video hides it and deletes the Mux asset immediately. The audit row stays.

Pending playback is signed. The public playback id is added only on approval, with a Mux referrer restriction for the site, its www and apex host, and localhost. The shop page does not use `og:video`. WhatsApp gets a 1200×630 JPEG of the poster with a play mark, from `/b/[slug]/video-card`.

The seller sees the decision on Manage storefront. There is no email. The rules for sellers are at `/video-policy`.

Leave the Mux variables unset and the rest of the site still builds and runs. Sellers then see “coming soon”. `MUX_MOCK=1` fakes the upload, the webhooks, and playback for local testing. Do not set that on Vercel. Do not call Mux from tests.

## Environment

| Variable | Local | Production (Vercel) |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` (SQLite, resolved from `prisma/`). | Neon Postgres URL, including `sslmode=require`. Use the **direct** connection string (host without `-pooler`) so `prisma db push` can create tables. |
| `AUTH_SECRET` | Any dev string. | A long random string. `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` | `true`. Auth.js already sets `trustHost` in `src/auth.ts`. |
| `AUTH_URL` | Omit. | `https://dala-sigma.vercel.app` (no path). Later, `https://rangach.co.ke`. |
| `NEXTAUTH_URL` | Omit. | Same value as `AUTH_URL`. |
| `APP_NAME` | Omit. The site name is Rangach. | Optional. Set only if the visible name should change. Default `Rangach`. |
| `APP_URL` | Omit. The dev server host is used for share links and the payment return URL. | `https://dala-sigma.vercel.app` (no path). Later, `https://rangach.co.ke`. If this is unset, `AUTH_URL` then `NEXTAUTH_URL` are used. |
| `HIDE_DEMO_SHOPS` | Leave unset. Seeded `@dala.local` shops and listings stay visible. Set to `1` to hide them. Their placeholder phone and WhatsApp numbers are never shown. | Leave unset so the sample shops stay visible until there are enough real shops. Set to `1` to hide them. |
| `FLW_SECRET_KEY` | Flutterwave test secret (`FLWSECK_TEST-…`). Omit to keep checkout disabled. | Test key until you are ready, then the live key (`FLWSECK-…`). |
| `FLW_PUBLIC_KEY` | Optional. Stored next to the secret. The hosted checkout does not send it to the browser. | Same. |
| `FLW_WEBHOOK_HASH` | Any long random string. The same value goes in the Flutterwave webhook settings. | Same value as the dashboard secret hash. |
| `BLOB_READ_WRITE_TOKEN` | Omit. Device upload stays off; paste a photo URL. | Set when you connect a Blob store. See **Photos**. |
| `MUX_TOKEN_ID` | Omit, or set with `MUX_MOCK=1` and no real calls. | Mux → Settings → Access Tokens. Video read and write. Production. |
| `MUX_TOKEN_SECRET` | Omit. | Shown once with the access token. Production. |
| `MUX_WEBHOOK_SECRET` | Any long string if you replay webhooks locally. | Signing secret for `https://www.rangach.co.ke/api/mux/webhook`. Production. |
| `MUX_SIGNING_KEY_ID` | Omit in mock mode. | Mux → Settings → Signing Keys. Production. |
| `MUX_SIGNING_PRIVATE_KEY` | Omit in mock mode. | Base64 private key Mux shows once. Production. |
| `MUX_AI_MODERATION` | Omit. | Set to `1` only if the admin should see a Mux Robots advisory. A person still approves. |
| `MUX_MOCK` | `1` to test without Mux. | Leave unset. |
| `ADMIN_EMAIL` | Omit. | `admin@rangach.co.ke`. Production, and Preview if preview deploys use the same database. Comma-separated if you ever need more than one. |
| `ADMIN_CLAIM_SECRET` | Omit. | 16 to 72 characters. The first login password for `ADMIN_EMAIL`. `openssl rand -base64 24` |
| `ADMIN_CLAIM_RESET` | Omit. | Leave unset. Set to `1` for one production deploy only when you need to replace the admin password, then delete it. |

Auth is email and password so the demo runs without an email server. A magic-link provider can replace the Credentials provider in `src/auth.ts` later. Sign-up does not prove you own the mailbox, so `ADMIN_EMAIL` is not granted admin from the register form. See **Production admin**.

The public controller name, registration number, proprietor line, phone, and postal address live in `src/lib/public-info.ts` (`LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_REG_NO`, `LEGAL_ENTITY_OWNER`, `BUSINESS_PHONE`, `BUSINESS_PHONE_TEL`, `BUSINESS_ADDRESS`). `BUSINESS_PHONE` is the spaced display number. `BUSINESS_PHONE_TEL` is the raw number used on tel: links. Proprietor and registration number render nothing while they are empty. Change the controller name in that one constant.

## Photos

Seller create and edit forms upload a photo from the device: listing photo, offering photo, shop cover (Verified Pro), and profile photo (the round picture on the shop). Drag a file on desktop, or use the phone camera roll / file picker. The browser resizes large photos (longest edge 1600px, JPEG) before upload. The server accepts JPEG, PNG, and WebP up to 5 MB and stores them in [Vercel Blob](https://vercel.com/docs/vercel-blob). The public `https` URL is saved on the existing string fields (`photoUrl`, `imageUrl`, `bannerUrl`, `avatarUrl`), so the storefront, listing pages, and edit screens render it the same way as a pasted URL.

Seeded shops keep their current image URLs. Paste-a-URL stays under **Paste a photo URL instead** for those links and for demo data. Only the signed-in owner can upload for their shop, offering, listing, or profile. An admin can upload for a listing or offering they are allowed to edit. There is still one photo per offering, and no cart.

### Add Blob on Vercel

1. Open the Vercel project → **Storage** → **Blob** → create a store and connect it to this project.
2. Confirm `BLOB_READ_WRITE_TOKEN` is set for **Production** (and **Preview** if preview URLs should upload). Do not commit the token or paste it into git.
3. Redeploy from the local clone (`git pull && npx vercel --prod` after the variable is saved). Until the token exists, upload returns an error and pasted photo URLs still save.

Locally, leave the variable unset, or copy the token into `.env` and restart `npm run dev`. Phone HEIC photos need to be JPEG, PNG, or WebP — choosing the photo again in Safari usually exports JPEG.

## Payments

### Payments are off until PAYMENTS_LIVE is on

`PAYMENTS_LIVE` is off unless it is `1`, `true`, `yes`, or `on`. While it is off, the pricing page, Promote, the account page, and the shop dashboard replace pay, promote, and upgrade buttons, and the “pay by M-Pesa or card” lines, with “Paid upgrades coming soon”. The pricing page still lists the plans and the prices, and labels each one Coming soon. `/upgrade` does not open the pay form. The server action that creates a checkout refuses with that same sentence, so a crafted request cannot start a payment. The Flutterwave webhook and `/upgrade/return` still reconcile a payment that is already in flight. Admin Grant, Add 30 days, and Remove for the Pro plan, shop checks, and listing verified stay available. Set `PAYMENTS_LIVE=1` and redeploy to restore checkout exactly as it works with the flag on.

Featured listing and Verified Pro use [Flutterwave](https://flutterwave.com) hosted checkout. One integration covers Kenya M-Pesa and cards. Paystack was the other candidate, but its charge currencies do not include GBP, and Diaspora prices are already in pounds. The app was not on Daraja: the old checkout only stored a simulated receipt.

There is no cart. Shop goods are still arranged on WhatsApp.

| Product | Price | What it unlocks |
| --- | --- | --- |
| Featured listing | KES 1,500 for shops in Kenya and East Africa, £12 for Diaspora shops | `listing.featured` and `featuredUntil` for 30 days. Browse keeps the listing raised while that date is in the future. A directory boost, separate from the shop. Paying again starts a new 30 days from that payment. A webhook retry does not. |
| Verified Pro | KES 2,500 for shops in Kenya and East Africa, £20 for Diaspora shops, per 30 days | `user.verifiedPro` and `user.verifiedProUntil`. The paid plan (shown as Pro plan), the shop cover banner, the shop video, and 20 offerings instead of 5, while that date is in the future. Paying again before it ends adds 30 days to the current end date. A webhook retry for the same payment does not. It does not grant Phone, Location, or Business verified, and it does not grant the green listing Verified badge. Those stay admin actions. |

M-Pesa is only offered when the price is in Kenyan shillings. Diaspora prices use card. The card number is entered on Flutterwave, not on Rangach. The Flutterwave checkout title and description use the site name (`Rangach — Featured listing for 30 days`, or `Rangach — Verified Pro for 30 days`).

### How a payment completes

1. Promote (`/upgrade`) creates a `Payment` row with status `pending` and a unique `reference`.
2. The server calls Flutterwave `POST /v3/payments` and redirects to the hosted page.
3. Flutterwave sends the buyer back to `/upgrade/return` with `status`, `tx_ref`, and `transaction_id`.
4. The server calls `GET /v3/transactions/{id}/verify`. Amount, currency, and reference must match the pending row. Only then is the listing featured or Verified Pro turned on, in the same database transaction as marking the row `paid`.
5. Flutterwave also `POST`s `/api/payments/flutterwave` with the `verif-hash` header. The handler checks that header against `FLW_WEBHOOK_HASH`, verifies the transaction again, and calls the same fulfillment. If the row is already `paid`, it returns 200 and does not move `featuredUntil` or `verifiedProUntil`.

If the buyer closes the tab, the webhook still completes the upgrade. If the webhook hash is not set yet, the return URL can still complete it, and the webhook answers 503.

### Test mode and missing keys

- No `FLW_SECRET_KEY`: Promote and Account → Payment settings explain how to add keys. The pay button stays disabled. The app does not crash and does not mark a fake payment as paid.
- Secret starts with `FLWSECK_TEST`: a test-mode banner is shown. Flutterwave sandbox only. No live M-Pesa prompt and no live card charge. Test card `5531 8866 5214 2950`, expiry `09/32`, CVV `564`, PIN `3310`, OTP `12345`. For M-Pesa use a number like `254712345678`. The sandbox does not bill Safaricom.
- Secret starts with `FLWSECK-`: live charges. Replace the test key in Vercel and redeploy. The banner goes away.
- A key that matches neither prefix is treated as not configured.
- Demo accounts use `@dala.local`. Flutterwave may reject those emails. Use a real email on the account you pay with.
- In the Flutterwave dashboard, turn on preferred payment methods so the checkout can limit a payment to M-Pesa or card.

### Add keys locally

```bash
# .env
FLW_SECRET_KEY="FLWSECK_TEST-..."
FLW_PUBLIC_KEY="FLWPUBK_TEST-..."
FLW_WEBHOOK_HASH="a-long-random-string"
# APP_URL="http://localhost:3000"
```

Restart `npm run dev`. For webhooks against your laptop, expose the dev server and set the Flutterwave webhook URL to `https://<that-host>/api/payments/flutterwave` with the same secret hash. Without a tunnel, paying still works: the return URL verifies the transaction when Flutterwave sends the browser back.

### Add keys on Vercel

In the project, **Settings → Environment Variables** (Production, and Preview if preview URLs should take test payments):

| Name | Value |
| --- | --- |
| `FLW_SECRET_KEY` | Test secret, then the live secret when you want real money |
| `FLW_PUBLIC_KEY` | The matching public key |
| `FLW_WEBHOOK_HASH` | The secret hash from the Flutterwave webhook form |
| `APP_URL` | `https://dala-sigma.vercel.app` (later `https://rangach.co.ke`) |
| `APP_NAME` | Optional. Leave unset to keep Rangach. |

In Flutterwave, set the webhook URL to `https://dala-sigma.vercel.app/api/payments/flutterwave` (or `https://rangach.co.ke/api/payments/flutterwave` after the domain cutover).

Redeploy after the variables are saved, from the local clone:

```bash
git pull && npx vercel --prod
```

## Production admin

The live admin is whoever you name in `ADMIN_EMAIL` (Kevin: `admin@rangach.co.ke`). The register form rejects that address. The production build creates the account if it is missing, with `ADMIN_CLAIM_SECRET` as the password and role `admin`. If someone has already registered that address, the same build replaces their password and only then sets admin, so a typed-in email cannot keep a password a stranger chose. The next deploys see an existing admin and leave the password and profile alone.

Set these in Vercel → **Settings → Environment Variables** before the deploy that should claim admin. Environment: **Production**. Also **Preview** if preview URLs use the same `DATABASE_URL`, so a preview cannot be used to register the address.

| Name | Value |
| --- | --- |
| `ADMIN_EMAIL` | `admin@rangach.co.ke` |
| `ADMIN_CLAIM_SECRET` | A password you choose, 16 to 72 characters. `openssl rand -base64 24` |

Do not set `ADMIN_CLAIM_RESET`. Add it as `1` later only if you must replace that password, redeploy once, then delete the variable.

From the local clone, after the variables are saved:

```bash
cd ~/dala && git pull && npx vercel --prod
```

Then sign in at `/login` as `admin@rangach.co.ke` with `ADMIN_CLAIM_SECRET`. Do not use **Create account**. Open `/admin`. `akinyi@dala.local` / `demo1234` should fail. `/b/mama-atieno` stays public unless `HIDE_DEMO_SHOPS=1`. That page does not show the sample phone or WhatsApp number.

If `ADMIN_EMAIL` is unset, the build still succeeds and nobody is promoted. A bad secret fails the build and does not change accounts.

## Deploy on Vercel

SQLite is fine on your laptop. Vercel serverless has no durable disk, so production uses Postgres. The committed schema stays `provider = "sqlite"`. `vercel.json` runs `npm run build:vercel`, which points Prisma at Postgres when `DATABASE_URL` starts with `postgres://` or `postgresql://`, creates the tables with `prisma db push`, loads the demo seed only when the user table is empty, then locks `@dala.local` demo logins and claims `ADMIN_EMAIL` on production. Later deploys do not wipe the database and do not reset an admin password that was already claimed.

About ten minutes, after this deploy config is on `main`:

1. Create a free database at [neon.tech](https://neon.tech). New project, name it `dala`. Open **Connect**, choose the **direct** connection (not the pooler), and copy the URI. It should look like `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
2. Open [vercel.com/new](https://vercel.com/new). Import the GitHub repo **raddi20/dala**. Framework preset: Next.js. Production branch: `main`. Root directory: `./`.
3. Before the first deploy, add these environment variables (Production, and Preview if you want preview URLs to work):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | The Neon URI from step 1 |
   | `AUTH_SECRET` | Output of `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | `true` |

4. Deploy. The build creates the tables and, because the database is empty, loads the Kenya, East Africa and the Diaspora demo shops.
5. The live site is `https://dala-sigma.vercel.app`. In the Vercel project, **Settings → Environment Variables**, add `AUTH_URL`, `NEXTAUTH_URL`, and `APP_URL`, each set to that exact origin (no trailing path). `APP_NAME` can stay unset. Redeploy once so sign-in cookies, share links, and payment return URLs use that host.
6. `/b/mama-atieno`, `/b/peckham-grocer`, and `/b/okello-and-co` are the seeded sample shops. They stay in the database and on the public site unless `HIDE_DEMO_SHOPS=1`. Their placeholder phone and WhatsApp numbers are not shown. `demo1234` works on your laptop only. On the live site, demo password login is disabled.
7. To take test payments, add the Flutterwave variables in **Payments** and redeploy from the local clone with `git pull && npx vercel --prod`.
8. To let sellers upload photos from a phone, connect a Blob store. See **Photos**. Pasted image URLs keep working without it.

Do not point production `DATABASE_URL` at `file:./dev.db`. The build refuses a non-Postgres URL on Vercel, and it refuses the sample `AUTH_SECRET` from `.env.example`.

`npx prisma db seed` loads demo data only when the user table is empty. If any user already exists, it exits without changing passwords, roles, shops, or listings. Rebuild a local SQLite demo with `npm run db:reset` (that deletes the local database). Do not point that command at the production Neon URL.

To point a laptop at Postgres for an **empty** database:

```bash
DATABASE_URL="postgresql://..." AUTH_SECRET="the-same-secret" node scripts/prepare-db-provider.mjs
npx prisma generate
npx prisma db seed
git checkout -- prisma/schema.prisma
```

`git checkout` puts the local schema back to SQLite so `npm run db:setup` keeps working. If that database already has users, the seed refuses and leaves them alone.

## Name and public URL

The header wordmark (gate mark plus the name), footer, page titles, Open Graph and Twitter tags, WhatsApp drafts, and Flutterwave checkout title all use `appName()` from `src/lib/brand.ts`. Set `APP_NAME` only if that visible name should change. The default is Rangach.

The public origin is the first of `APP_URL`, `AUTH_URL`, and `NEXTAUTH_URL` that is set. That is the same order payments already used, so an existing value keeps working and there is no second URL variable to keep in sync. It is used for `metadataBase`, canonical and Open Graph URLs, share links, WhatsApp texts that include a page URL, and the Flutterwave return URL (`/upgrade/return`). Do not put a path on it. When none of those are set, share links and the return URL use the request host, and the payment setup instructions fall back to `https://dala-sigma.vercel.app`.

The default artwork is `public/logo.svg` (gate plus the word Rangach). The header uses the same gate, with the live name beside it, so `APP_NAME` still changes the word. Favicon and Apple icon are generated from `src/app/icon.tsx` and `src/app/apple-icon.tsx`. The share image is `src/app/opengraph-image.tsx` (and the same file for Twitter).

### Moving to rangach.co.ke

Do this after the domain is registered. No code change is required.

1. In the Vercel project, open **Settings → Domains** and add `rangach.co.ke` (and `www.rangach.co.ke` if you want it). Vercel shows the DNS records to create.
2. At the registrar for `.co.ke`, add those records (usually an `A` record for the apex and a `CNAME` for `www`, pointing at the hosts Vercel displays). Wait until Vercel marks the domain valid.
3. In **Settings → Environment Variables**, set `APP_URL`, `AUTH_URL`, and `NEXTAUTH_URL` to `https://rangach.co.ke` (no path, no trailing slash) for Production.
4. In the Flutterwave dashboard, change the webhook URL to `https://rangach.co.ke/api/payments/flutterwave`. Keep the same secret hash.
5. Redeploy from the local clone: `git pull && npx vercel --prod`.
6. Open `https://rangach.co.ke`, a shop such as `/b/mama-atieno`, and a WhatsApp draft, and confirm the links use the new host. Sign out and sign in once so the session cookie is set on that host.

The `dala-sigma.vercel.app` hostname can stay attached. With `APP_URL` set, share links and payment returns use `https://rangach.co.ke` even if someone opens the Vercel hostname.

### Left as-is on purpose

These still say `dala` because changing them would break existing data, sessions, or payment checks:

- GitHub repo `raddi20/dala`, the npm package name, Prisma models and tables, and the Neon database. Do not rename them for this rebrand.
- Demo sign-in emails `@dala.local` (shop contact lines, seed accounts). Flutterwave rejects those addresses; the checkout error still names `@dala.local`. Production disables password login for them and hides the demo password on the sign-in page. Local development still shows it.
- Payment references that start with `dala_`. Flutterwave webhooks match on that reference. New checkouts still use it.
- Simulated seed receipts already stored as `DALA-MPESA-0101` and `DALA-CARD-4242`. They stay on that database and show on the demo receipt list. A fresh seed uses `RANGACH-MPESA-0101` and `RANGACH-CARD-4242` instead. Those rows are not sent to Flutterwave.
- Session cookie names and Blob pathnames. They do not include the brand, and they were not renamed.
- The sample `AUTH_SECRET` in `.env.example` (`dala-dev-secret-change-me`). Production must not use that sample secret; the Vercel build still rejects it.
- The local clone folder, if it is still named `dala`.

An already-seeded profile bio that still says "Moderates the Dala demo…" is rewritten to Rangach on the next `build:vercel` (exact sentence only). Other profile text, passwords, and roles are left alone by that rewrite.

To add a city, edit `src/lib/constants.ts` (`CITIES`). Nairobi is homeland. London is diaspora. The region is stored on each listing from that list.

## Postgres

Local development keeps the SQLite migrations in `prisma/migrations`. Production does not run those files. On Vercel, `prisma db push` creates the same models in Postgres. The schema uses strings rather than database enums so that push does not need a second migration history.

See **Deploy on Vercel** for the Neon connection string. A local Postgres database works the same way: set `DATABASE_URL` to a `postgresql://` URL, run `node scripts/prepare-db-provider.mjs`, then `npx prisma db push` and `npx prisma db seed`. Check the schema file back to SQLite afterward if you still want `npm run db:setup` on the laptop.

## What is in the prototype

- Person and business profiles, with email/password sign-in.
- Create, edit, and delete listings. Photos upload from the device (JPEG, PNG, or WebP) and are stored as an `https` URL. A pasted URL still works. Blank photos use a placeholder.
- Listing types: business directory, plus classifieds (`for_sale`, `wanted`, `housing`, `services`).
- Filters: words, city, homeland vs diaspora, category, type, verified listing only, and shop badge (any, phone, location, or business). A sentence search still maps onto the older filters, including verified listings. It does not guess a shop badge.
- Listing Verified badge, granted by an admin. Phone, Location, and Business verified on a shop, also granted by an admin, with an audit trail. Shown on the shop, listing cards, and the seller account. Verified Pro stays the paid plan and is labelled Pro plan next to those checks.
- Star reviews. Report a listing or profile. Block a person (their listings drop out of your browse).
- Admin: list and hide listings, grant or remove listing Verified, grant or remove shop checks, grant or remove Pro plan, dismiss or act on reports.
- WhatsApp: chat the contact, or share the listing, both via `wa.me` with the listing URL in the text.
- Shop pages at `/b/[slug]` with offerings, a WhatsApp draft that names the offering, and seller publish controls. See **Shops** above.
- Featured listing and Verified Pro checkout through Flutterwave (M-Pesa and card). Disabled until keys are set. See **Payments**.
- New listings get a scam-risk flag from keyword rules (wires, gift cards, "pay first", guaranteed returns, and similar). High and medium results show on the listing.

## Out of scope

Social feed, dating, remittances, a shipping marketplace, and automated KYC. Transport listings here are local cabs and couriers, not a parcel marketplace. Shops do not add a cart, checkout, inventory, or a gallery of more than one photo per offering.

## Layout

- `src/app` — pages, including `b/[slug]` for a public shop and `account/storefront` for the seller editor
- `src/lib/brand.ts` — name, tagline, and public URL helpers (`APP_NAME`, `APP_URL`)
- `src/lib/constants.ts` — cities, categories, prices
- `src/lib/payments` — Flutterwave checkout, verification, and idempotent fulfillment
- `src/lib/nl-query.ts` — sentence to filters
- `src/lib/draft.ts` — listing draft assist
- `src/lib/scam.ts` — risk rules
- `src/auth.ts` — Auth.js credentials
- `prisma/schema.prisma` — data model (SQLite locally; Vercel build switches it to Postgres)
- `vercel.json` — production build: push the schema, then seed an empty database
