import Link from "next/link";
import { curateOccasion } from "@/lib/actions/occasions";
import { btnSecondary, fieldClass } from "@/components/ui";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";

export async function AdminOccasions() {
  await ensureOccasionDefinitions(prisma);
  const [occasions, shops, listings] = await Promise.all([
    prisma.occasion.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        shops: {
          orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
          include: { storefront: { select: { slug: true, user: { select: { name: true } } } } },
        },
        listings: {
          orderBy: [{ pinned: "desc" }, { createdAt: "asc" }],
          include: { listing: { select: { id: true, title: true, hidden: true } } },
        },
      },
    }),
    prisma.storefront.findMany({
      orderBy: { user: { name: "asc" } },
      select: { id: true, slug: true, published: true, user: { select: { name: true } } },
    }),
    prisma.listing.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, city: true, hidden: true },
    }),
  ]);

  return (
    <section id="occasions" className="grid gap-4">
      <div>
        <h2 className="font-serif text-2xl">Occasions</h2>
        <p className="mt-1 text-sm text-ink/70">
          Sellers tick an occasion on their shop or listing. You can add or remove any shop or listing here, pin the ones
          that should lead the page, and edit the title and intro. Saving copy does not reset anyone&apos;s tags. A deploy
          never overwrites an intro you have saved.
        </p>
      </div>
      {occasions.map((occasion) => (
        <article key={occasion.id} className="grid gap-4 rounded-2xl border border-sand bg-card p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/occasions/${occasion.slug}`} className="font-semibold">
              {occasion.title}
            </Link>
            <span className="text-ink/55">/occasions/{occasion.slug}</span>
          </div>
          <form action={curateOccasion} className="grid gap-3">
            <input type="hidden" name="action" value="save-copy" />
            <input type="hidden" name="occasionId" value={occasion.id} />
            <label className="block">
              Title
              <input name="title" defaultValue={occasion.title} maxLength={80} required className={fieldClass} />
            </label>
            <label className="block">
              Intro
              <textarea name="intro" defaultValue={occasion.intro} rows={5} maxLength={1500} className={fieldClass} />
            </label>
            <button className={`${btnSecondary} w-fit`} type="submit">
              Save intro
            </button>
          </form>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <h3 className="font-semibold">Shops on this page</h3>
              {occasion.shops.length === 0 ? <p className="text-ink/60">None yet.</p> : null}
              <ul className="grid gap-2">
                {occasion.shops.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                    <span>
                      <Link href={`/b/${row.storefront.slug}`} className="font-semibold text-lake-dark">
                        {row.storefront.user.name}
                      </Link>
                      {row.pinned ? " · Pinned" : ""}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <form action={curateOccasion}>
                        <input type="hidden" name="action" value={row.pinned ? "unpin-shop" : "pin-shop"} />
                        <input type="hidden" name="occasionId" value={occasion.id} />
                        <input type="hidden" name="storefrontId" value={row.storefrontId} />
                        <button className={btnSecondary} type="submit">
                          {row.pinned ? "Unpin" : "Pin"}
                        </button>
                      </form>
                      <form action={curateOccasion}>
                        <input type="hidden" name="action" value="untag-shop" />
                        <input type="hidden" name="occasionId" value={occasion.id} />
                        <input type="hidden" name="storefrontId" value={row.storefrontId} />
                        <button className={btnSecondary} type="submit">
                          Remove
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
              <form action={curateOccasion} className="grid gap-2">
                <input type="hidden" name="action" value="tag-shop" />
                <input type="hidden" name="occasionId" value={occasion.id} />
                <label>
                  Add a shop
                  <select name="storefrontId" defaultValue="" required className={fieldClass}>
                    <option value="" disabled>
                      Choose a shop
                    </option>
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.user.name} ({shop.published ? "published" : "draft"})
                      </option>
                    ))}
                  </select>
                </label>
                <button className={`${btnSecondary} w-fit`} type="submit">
                  Add shop
                </button>
              </form>
            </div>

            <div className="grid gap-2">
              <h3 className="font-semibold">Listings on this page</h3>
              {occasion.listings.length === 0 ? <p className="text-ink/60">None yet.</p> : null}
              <ul className="grid gap-2">
                {occasion.listings.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                    <span>
                      <Link href={`/listings/${row.listing.id}`} className="font-semibold text-lake-dark">
                        {row.listing.title}
                      </Link>
                      {row.pinned ? " · Pinned" : ""}
                      {row.listing.hidden ? " · Hidden" : ""}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <form action={curateOccasion}>
                        <input type="hidden" name="action" value={row.pinned ? "unpin-listing" : "pin-listing"} />
                        <input type="hidden" name="occasionId" value={occasion.id} />
                        <input type="hidden" name="listingId" value={row.listingId} />
                        <button className={btnSecondary} type="submit">
                          {row.pinned ? "Unpin" : "Pin"}
                        </button>
                      </form>
                      <form action={curateOccasion}>
                        <input type="hidden" name="action" value="untag-listing" />
                        <input type="hidden" name="occasionId" value={occasion.id} />
                        <input type="hidden" name="listingId" value={row.listingId} />
                        <button className={btnSecondary} type="submit">
                          Remove
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
              <form action={curateOccasion} className="grid gap-2">
                <input type="hidden" name="action" value="tag-listing" />
                <input type="hidden" name="occasionId" value={occasion.id} />
                <label>
                  Add a listing
                  <select name="listingId" defaultValue="" required className={fieldClass}>
                    <option value="" disabled>
                      Choose a listing
                    </option>
                    {listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title} · {listing.city}
                        {listing.hidden ? " · hidden" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={`${btnSecondary} w-fit`} type="submit">
                  Add listing
                </button>
              </form>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
