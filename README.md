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

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file. Default `file:./dev.db`, resolved from the `prisma/` directory. |
| `AUTH_SECRET` | Signs the Auth.js session cookie. Change it before any shared deployment. |
| `AUTH_TRUST_HOST` | Allows Auth.js on localhost. |

Auth is email and password so the demo runs without an email server. A magic-link provider can replace the Credentials provider in `src/auth.ts` later.

## Rename

1. Change `APP_NAME`, `APP_MEANING`, and `APP_TAGLINE` in `src/lib/brand.ts`. The header mark uses the first letter of `APP_NAME`.
2. Demo emails use `@dala.local`. They are seed data only (`prisma/seed.ts`).
3. Add a city in `src/lib/constants.ts` (`CITIES`). Nairobi is homeland. London is diaspora. The region is stored on each listing from that list.

## Postgres

The committed migration targets SQLite. For Postgres:

1. In `prisma/schema.prisma`, set `provider = "postgresql"`.
2. Set `DATABASE_URL` to a Postgres URL, for example `postgresql://user:pass@localhost:5432/dala?schema=public`.
3. Delete `prisma/migrations` and create a new one with `npx prisma migrate dev --name init`.
4. Run `npx prisma db seed`.

The schema uses strings rather than database enums so the model itself does not need a rewrite.

## What is in the prototype

- Person and business profiles, with email/password sign-in.
- Create, edit, and delete listings. Photo field accepts an `http(s)` URL. Blank photos use a placeholder.
- Listing types: business directory, plus classifieds (`for_sale`, `wanted`, `housing`, `services`).
- Filters: words, city, homeland vs diaspora, category, type, verified only. A sentence search maps onto those filters locally.
- Verified badge, granted by an admin. Verified Pro is a separate paid badge.
- Star reviews. Report a listing or profile. Block a person (their listings drop out of your browse).
- Admin: list and hide listings, grant or remove Verified, grant or remove Pro, dismiss or act on reports.
- WhatsApp: chat the contact, or share the listing, both via `wa.me` with the listing URL in the text.
- Featured listing and Verified Pro checkout. M-Pesa and card forms are placeholders. The receipt is marked paid and the badge updates. No money moves.
- New listings get a scam-risk flag from keyword rules (wires, gift cards, "pay first", guaranteed returns, and similar). High and medium results show on the listing.

## Out of scope

Social feed, dating, remittances, a shipping marketplace, and automated KYC. Transport listings here are local cabs and couriers, not a parcel marketplace.

## Layout

- `src/app` — pages
- `src/lib/brand.ts` — name
- `src/lib/constants.ts` — cities, categories, prices
- `src/lib/nl-query.ts` — sentence to filters
- `src/lib/draft.ts` — listing draft assist
- `src/lib/scam.ts` — risk rules
- `src/auth.ts` — Auth.js credentials
- `prisma/schema.prisma` — data model
