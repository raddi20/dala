import Link from "next/link";
import { APP_MEANING, APP_TAGLINE, AUDIENCE_LINE, appName } from "@/lib/brand";
import { FREE_OFFERING_CAP } from "@/lib/constants";
import { LAUNCH_ROUTES, LIST_PATH } from "@/lib/launch-pages";
import { PAID_UPGRADES_COMING_SOON } from "@/lib/payments/live";
import { CONTACT_EMAIL, publicBusinessPhone, publicBusinessPhoneTel } from "@/lib/public-info";
import { SHOP_BADGES } from "@/lib/shop-badges";
import { MAX_DURATION_SECONDS } from "@/lib/video/constants";
import { btnNavy, cardClass } from "@/components/ui";

const ctaClass = `${btnNavy} min-h-12 w-full px-5 text-base`;

export function WelcomeGuide({ paymentsOpen = false }: { paymentsOpen?: boolean }) {
  const name = appName();
  const phone = publicBusinessPhone();
  const tel = publicBusinessPhoneTel();
  const badges = SHOP_BADGES.map((badge) => badge.label).join(", ");

  return (
    <article className="mx-auto grid max-w-2xl gap-5 px-4 py-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-lake">{name}</p>
        <h1 className="mt-2 font-serif text-3xl text-navy">Learn about Rangach</h1>
        <p className="mt-3 text-base leading-relaxed text-ink">
          {name} is the gateway to the Luo home. {APP_TAGLINE} The name is {APP_MEANING}.
        </p>
      </header>

      <Link href={LIST_PATH} className={ctaClass}>
        List your business free
      </Link>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">What Rangach is</h2>
        <p className="text-base leading-relaxed text-ink">
          A directory of Luo-owned businesses, housing, and classifieds in {AUDIENCE_LINE}. You find a shop or a
          listing here. The chat, and the payment for what you buy, stay on WhatsApp or on a phone call.
        </p>
      </section>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Who it is for</h2>
        <ul className="grid gap-3 text-base leading-relaxed text-ink">
          <li>Sellers who want people to find the business, a room, or something for sale.</li>
          <li>Buyers in Kenya and East Africa.</li>
          <li>The diaspora buying for family back home.</li>
        </ul>
      </section>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Why list</h2>
        <ul className="grid gap-3 text-base leading-relaxed text-ink">
          <li>It is free to open a shop. A free shop can show {FREE_OFFERING_CAP} offerings.</li>
          <li>Buyers contact you directly on WhatsApp, or by phone when you add a number on your account.</li>
          <li>
            Verification badges — {badges} — are granted by an admin after a check. They are not for sale, and they
            are not added on their own.
          </li>
          <li>
            A shop video, up to {MAX_DURATION_SECONDS} seconds, needs Verified Pro.
            {paymentsOpen ? "" : `${PAID_UPGRADES_COMING_SOON}. `}A free shop does not show a video. An admin watches a
            video before anyone else can.
          </li>
        </ul>
      </section>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Occasions</h2>
        <p className="text-base leading-relaxed text-ink">
          Homecomings, weddings and ayie, funerals, Christmas at home, and a house back home.
        </p>
        <Link href={LAUNCH_ROUTES.occasions} className={`${btnNavy} min-h-12 w-full px-5 text-base`}>
          See occasions
        </Link>
      </section>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Contact</h2>
        <p className="text-base leading-relaxed text-ink">Questions about a listing or a shop.</p>
        {phone && tel ? (
          <a href={`tel:${tel}`} className={ctaClass}>
            Call {phone}
          </a>
        ) : null}
        <a href={`mailto:${CONTACT_EMAIL}`} className={`${btnNavy} min-h-12 w-full break-all px-5 text-base`}>
          {CONTACT_EMAIL}
        </a>
      </section>

      <Link href={LIST_PATH} className={ctaClass}>
        List your business free
      </Link>
    </article>
  );
}
