# Dala

Verified Luo business directory and classifieds. Kenya first, diaspora second. WhatsApp stays the place to chat. Dala is for discovery, trust, and paid visibility.

The name is a working title. **Dala** is Dholuo for "home".

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

Every seeded account uses the password `demo1234`.

| Email | Who |
| --- | --- |
| `akinyi@dala.local` | Admin. Hide listings, grant Verified, close reports. |
| `atieno@dala.local` | Nairobi restaurant and events. |
| `okello@dala.local` | London solicitor. Already on Verified Pro. |
| `grace@dala.local` | Nairobi beauty, clinic, and fellowship. |
| `mary@dala.local` | Nairobi trades, garage, and shop. |
| `peter@dala.local` | London grocer, kitchen, and cabs. |
| `achieng@dala.local` | Nairobi resident. Tutoring and classifieds. |
| `james@dala.local` | London resident. Rooms and a flagged plot advert. |

Try the sentence search with `verified restaurants in Nairobi` or `housing in London`. The high-risk plot advert and the "limited offer" sofa are there so the scam check is visible. One phone advert is already hidden for the admin queue.

## Shops

A published shop is a public page at `/b/[slug]`. It shows a banner (Verified Pro), the profile about text, a WhatsApp button, and the seller's offerings. Buyers do not need an account. There is no cart, checkout, stock count, or shipping. The WhatsApp draft names the offering and includes the shop URL. The product name in that sentence comes from `src/lib/brand.ts` (`Hi, I saw {offering} on your {APP_NAME} shop ({url})…`).

| Shop | City | Seller | Notes |
| --- | --- | --- | --- |
| `/b/mama-atieno` | Nairobi | `atieno@dala.local` | Free. Four offerings. |
| `/b/peckham-grocer` | London | `peter@dala.local` | Free. Four offerings. |
| `/b/okello-and-co` | London | `okello@dala.local` | Verified Pro. Cover banner and four offerings. |

Sign in as the seller and open **Manage storefront** from Account, the header (**Open a shop**), or the listing edit page. Home and the header use the same labels. Signed-out visitors go to sign-in and return to shop setup or the listing form.

With no shop yet, Manage storefront shows three steps: create the shop from your profile, add a first offering, then publish. After the first offering, that page asks you to publish and shows the WhatsApp line buyers will send. From there you can change the address, write the about text, add or edit offerings, archive them, move them up or down, and publish. Unpublished shops return a not-found page to everyone except the owner, who can still preview.

Free shops list up to 5 offerings. Verified Pro (`user.verifiedPro`, already used by the paid badge) raises that to 20 and unlocks the cover banner. Featured listing is unchanged: it is a directory boost, separate from the shop. A "featured shop" flag is left for later.

Listing cards show **Shop**, and the listing page shows **Visit storefront**, when that seller's shop is published.

## Environment

| Variable | Local | Production (Vercel) |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` (SQLite, resolved from `prisma/`). | Neon Postgres URL, including `sslmode=require`. Use the **direct** connection string (host without `-pooler`) so `prisma db push` can create tables. |
| `AUTH_SECRET` | Any dev string. | A long random string. `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` | `true`. Auth.js already sets `trustHost` in `src/auth.ts`. |
| `AUTH_URL` | Omit. | `https://<project>.vercel.app` once Vercel assigns the URL. |
| `NEXTAUTH_URL` | Omit. | Same value as `AUTH_URL`. |
| `FLW_SECRET_KEY` | Flutterwave test secret (`FLWSECK_TEST-…`). Omit to keep checkout disabled. | Test key until you are ready, then the live key (`FLWSECK-…`). |
| `FLW_PUBLIC_KEY` | Optional. Stored next to the secret. The hosted checkout does not send it to the browser. | Same. |
| `FLW_WEBHOOK_HASH` | Any long random string. The same value goes in the Flutterwave webhook settings. | Same value as the dashboard secret hash. |
| `APP_URL` | Omit. The dev server host is used for the return URL. | `https://dala-sigma.vercel.app` (no path). |

Auth is email and password so the demo runs without an email server. A magic-link provider can replace the Credentials provider in `src/auth.ts` later.

## Payments

Featured listing and Verified Pro use [Flutterwave](https://flutterwave.com) hosted checkout. One integration covers Kenya M-Pesa and cards. Paystack was the other candidate, but its charge currencies do not include GBP, and London prices are already in pounds. The app was not on Daraja: the old checkout only stored a simulated receipt.

There is no cart. Shop goods are still arranged on WhatsApp.

| Product | Price | What it unlocks |
| --- | --- | --- |
| Featured listing | KES 1,500 in Nairobi, £12 in London | `listing.featured` and `featuredUntil` for 30 days. Browse keeps the listing raised while that date is in the future. A directory boost, separate from the shop. Paying again starts a new 30 days from that payment. A webhook retry does not. |
| Verified Pro | KES 2,500 in Nairobi, £20 in London | `user.verifiedPro`. The paid badge, the shop cover banner, and 20 offerings instead of 5. It does not grant the green Verified badge. That stays an admin action. |

M-Pesa is only offered when the price is in Kenyan shillings. London prices use card. The card number is entered on Flutterwave, not on Dala.

### How a payment completes

1. Promote (`/upgrade`) creates a `Payment` row with status `pending` and a unique `reference`.
2. The server calls Flutterwave `POST /v3/payments` and redirects to the hosted page.
3. Flutterwave sends the buyer back to `/upgrade/return` with `status`, `tx_ref`, and `transaction_id`.
4. The server calls `GET /v3/transactions/{id}/verify`. Amount, currency, and reference must match the pending row. Only then is the listing featured or Verified Pro turned on, in the same database transaction as marking the row `paid`.
5. Flutterwave also `POST`s `/api/payments/flutterwave` with the `verif-hash` header. The handler checks that header against `FLW_WEBHOOK_HASH`, verifies the transaction again, and calls the same fulfillment. If the row is already `paid`, it returns 200 and does not move `featuredUntil`.

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
| `APP_URL` | `https://dala-sigma.vercel.app` |

In Flutterwave, set the webhook URL to `https://dala-sigma.vercel.app/api/payments/flutterwave`.

Redeploy after the variables are saved:

```bash
cd ~/dala && git pull && npx vercel --prod
```

## Deploy on Vercel

SQLite is fine on your laptop. Vercel serverless has no durable disk, so production uses Postgres. The committed schema stays `provider = "sqlite"`. `vercel.json` runs `npm run build:vercel`, which points Prisma at Postgres when `DATABASE_URL` starts with `postgres://` or `postgresql://`, creates the tables with `prisma db push`, and loads the demo seed only when the user table is empty. Later deploys do not wipe the database.

About ten minutes, after this deploy config is on `main`:

1. Create a free database at [neon.tech](https://neon.tech). New project, name it `dala`. Open **Connect**, choose the **direct** connection (not the pooler), and copy the URI. It should look like `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
2. Open [vercel.com/new](https://vercel.com/new). Import the GitHub repo **raddi20/dala**. Framework preset: Next.js. Production branch: `main`. Root directory: `./`.
3. Before the first deploy, add these environment variables (Production, and Preview if you want preview URLs to work):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | The Neon URI from step 1 |
   | `AUTH_SECRET` | Output of `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | `true` |

4. Deploy. The build creates the tables and, because the database is empty, loads the Nairobi and London demo shops.
5. Copy the deployment URL, for example `https://dala-xxxxx.vercel.app`. In the Vercel project, **Settings → Environment Variables**, add `AUTH_URL` and `NEXTAUTH_URL`, both set to that exact origin (no trailing path). Redeploy once so sign-in cookies use that host.
6. Open `/b/mama-atieno`, `/b/peckham-grocer`, and `/b/okello-and-co`. Demo password is `demo1234`.
7. To take test payments, add the Flutterwave variables in **Payments** and redeploy with `cd ~/dala && git pull && npx vercel --prod`.

Do not point production `DATABASE_URL` at `file:./dev.db`. The build refuses a non-Postgres URL on Vercel, and it refuses the sample `AUTH_SECRET` from `.env.example`.

To reload demo data later from your laptop (this **deletes** whatever is in that database, then reseeds):

```bash
DATABASE_URL="postgresql://..." AUTH_SECRET="the-same-secret" node scripts/prepare-db-provider.mjs
npx prisma generate
npx prisma db seed
git checkout -- prisma/schema.prisma
```

`git checkout` puts the local schema back to SQLite so `npm run db:setup` keeps working.

## Rename

1. Change `APP_NAME`, `APP_MEANING`, and `APP_TAGLINE` in `src/lib/brand.ts`. The header mark uses the first letter of `APP_NAME`.
2. Demo emails use `@dala.local`. They are seed data only (`prisma/seed.ts`).
3. Add a city in `src/lib/constants.ts` (`CITIES`). Nairobi is homeland. London is diaspora. The region is stored on each listing from that list.

## Postgres

Local development keeps the SQLite migrations in `prisma/migrations`. Production does not run those files. On Vercel, `prisma db push` creates the same models in Postgres. The schema uses strings rather than database enums so that push does not need a second migration history.

See **Deploy on Vercel** for the Neon connection string. A local Postgres database works the same way: set `DATABASE_URL` to a `postgresql://` URL, run `node scripts/prepare-db-provider.mjs`, then `npx prisma db push` and `npx prisma db seed`. Check the schema file back to SQLite afterward if you still want `npm run db:setup` on the laptop.

## What is in the prototype

- Person and business profiles, with email/password sign-in.
- Create, edit, and delete listings. Photo field accepts an `http(s)` URL. Blank photos use a placeholder.
- Listing types: business directory, plus classifieds (`for_sale`, `wanted`, `housing`, `services`).
- Filters: words, city, homeland vs diaspora, category, type, verified only. A sentence search maps onto those filters locally.
- Verified badge, granted by an admin. Verified Pro is a separate paid badge.
- Star reviews. Report a listing or profile. Block a person (their listings drop out of your browse).
- Admin: list and hide listings, grant or remove Verified, grant or remove Pro, dismiss or act on reports.
- WhatsApp: chat the contact, or share the listing, both via `wa.me` with the listing URL in the text.
- Shop pages at `/b/[slug]` with offerings, a WhatsApp draft that names the offering, and seller publish controls. See **Shops** above.
- Featured listing and Verified Pro checkout through Flutterwave (M-Pesa and card). Disabled until keys are set. See **Payments**.
- New listings get a scam-risk flag from keyword rules (wires, gift cards, "pay first", guaranteed returns, and similar). High and medium results show on the listing.

## Out of scope

Social feed, dating, remittances, a shipping marketplace, and automated KYC. Transport listings here are local cabs and couriers, not a parcel marketplace. Shops do not add a cart, checkout, inventory, or a gallery of more than one photo per offering.

## Layout

- `src/app` — pages, including `b/[slug]` for a public shop and `account/storefront` for the seller editor
- `src/lib/brand.ts` — name
- `src/lib/constants.ts` — cities, categories, prices
- `src/lib/payments` — Flutterwave checkout, verification, and idempotent fulfillment
- `src/lib/nl-query.ts` — sentence to filters
- `src/lib/draft.ts` — listing draft assist
- `src/lib/scam.ts` — risk rules
- `src/auth.ts` — Auth.js credentials
- `prisma/schema.prisma` — data model (SQLite locally; Vercel build switches it to Postgres)
- `vercel.json` — production build: push the schema, then seed an empty database
