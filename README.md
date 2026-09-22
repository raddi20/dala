# Dala

Verified Luo business directory and classifieds. Kenya first, diaspora second. WhatsApp stays the place to chat. Dala is for discovery, trust, and paid visibility.

The name is a working title. **Dala** is Dholuo for "home".

This is a clickable local prototype. Sample businesses are fictional. Payments are simulated. Nothing here files a charge or sends an M-Pesa prompt.

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

Auth is email and password so the demo runs without an email server. A magic-link provider can replace the Credentials provider in `src/auth.ts` later.

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
- Featured listing and Verified Pro checkout. M-Pesa and card forms are placeholders. The receipt is marked paid and the badge updates. No money moves.
- New listings get a scam-risk flag from keyword rules (wires, gift cards, "pay first", guaranteed returns, and similar). High and medium results show on the listing.

## Out of scope

Social feed, dating, remittances, a shipping marketplace, and automated KYC. Transport listings here are local cabs and couriers, not a parcel marketplace. Shops do not add a cart, checkout, inventory, or a gallery of more than one photo per offering.

## Layout

- `src/app` — pages, including `b/[slug]` for a public shop and `account/storefront` for the seller editor
- `src/lib/brand.ts` — name
- `src/lib/constants.ts` — cities, categories, prices
- `src/lib/nl-query.ts` — sentence to filters
- `src/lib/draft.ts` — listing draft assist
- `src/lib/scam.ts` — risk rules
- `src/auth.ts` — Auth.js credentials
- `prisma/schema.prisma` — data model (SQLite locally; Vercel build switches it to Postgres)
- `vercel.json` — production build: push the schema, then seed an empty database
