import type { ReactNode } from "react";
import Link from "next/link";
import type { GuideProgress, GuideStepId } from "@/lib/launch-pages";
import {
  LAUNCH_ROUTES,
  guideCurrentStep,
  guideStepDone,
  liveStepLink,
  shopStepLink,
} from "@/lib/launch-pages";
import { FREE_OFFERING_CAP } from "@/lib/constants";
import { appName } from "@/lib/brand";
import { CONTACT_EMAIL, publicBusinessPhone, publicBusinessPhoneTel } from "@/lib/public-info";
import { SHOP_BADGES } from "@/lib/shop-badges";
import { MAX_DURATION_SECONDS } from "@/lib/video/constants";
import { btnNavy, btnSecondary, cardClass } from "@/components/ui";

const actionClass = `${btnNavy} min-h-12 w-full px-5 text-base`;
const doneClass = `${btnSecondary} min-h-12 w-full px-5 text-base`;

export function ListGuide({
  progress,
  listingWriter,
}: {
  progress: GuideProgress;
  listingWriter: boolean;
}) {
  const name = appName();
  const current = guideCurrentStep(progress);
  const shop = shopStepLink(progress);
  const live = liveStepLink(progress);
  const phone = publicBusinessPhone();
  const tel = publicBusinessPhoneTel();
  const badges = SHOP_BADGES.map((badge) => badge.label).join(", ");

  return (
    <article className="mx-auto grid max-w-2xl gap-5 px-4 py-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-lake">{name}</p>
        <h1 className="mt-2 font-serif text-3xl text-navy">List your business</h1>
        <p className="mt-3 text-base leading-relaxed text-ink">
          Listing is free. Buyers message you on WhatsApp. These steps are the pages {name} uses today.
        </p>
      </header>

      {current ? (
        <p className="rounded-2xl bg-amber-soft px-4 py-3 text-base text-ink">
          <a href={`#step-${current}`} className="font-semibold text-navy underline-offset-2 hover:underline">
            Continue at {stepTitle(current)}
          </a>
        </p>
      ) : null}

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">What you need</h2>
        <ul className="grid gap-2 text-base leading-relaxed text-ink">
          <li>A phone</li>
          <li>3–5 good photos to choose from</li>
          <li>A WhatsApp number</li>
          <li>Your prices</li>
        </ul>
        <p className="text-base leading-relaxed text-ink">
          The listing form saves one photo, and each shop offering saves one. Bring a few and use the clearest.
        </p>
      </section>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Photo tips</h2>
        <ul className="grid gap-2 text-base leading-relaxed text-ink">
          <li>Shoot in daylight, close enough to see the food, the room, or the work.</li>
          <li>Skip blurry photos.</li>
          <li>JPEG, PNG, or WebP. Large photos from the phone are resized before they upload.</li>
          <li>Do not photograph a child unless you have consent.</li>
        </ul>
      </section>

      <ol className="grid gap-4">
        <Step
          n={1}
          id="account"
          title="Create an account"
          state={stepState("account", progress, current)}
          href={progress.signedIn ? LAUNCH_ROUTES.account : LAUNCH_ROUTES.registerReturn}
          label={progress.signedIn ? "Your account" : "Create an account"}
        >
          <p>
            Name, email, and a password. Choose a person or a business, and Nairobi or the Diaspora. It is free.
          </p>
        </Step>

        <Step n={2} id="shop" title="Set up the shop" state={stepState("shop", progress, current)} href={shop.href} label={shop.label}>
          <p>
            The shop name starts from your profile name. Press Start your shop, then add a first offering: a title, a
            price, and a photo if you have one. The shop stays a draft until you publish it. A free shop can list{" "}
            {FREE_OFFERING_CAP} offerings.
          </p>
        </Step>

        <Step
          n={3}
          id="listing"
          title="Add the first listing"
          state={stepState("listing", progress, current)}
          href={LAUNCH_ROUTES.listing}
          label={progress.hasListing ? "Add another listing" : "Add a listing"}
        >
          <p>
            This is the directory listing, separate from the offerings on the shop. On Add a listing, choose Business,
            then a title, a price, and a photo. Listing assist can fill the form from one sentence on this phone.
            Nothing is public until you press Publish.
          </p>
          {listingWriter ? (
            <p>
              On that same page, Write it for me can draft the listing after you agree. You check the draft before you
              publish.
            </p>
          ) : null}
        </Step>

        <Step
          n={4}
          id="whatsapp"
          title="Add a WhatsApp number"
          state={stepState("whatsapp", progress, current)}
          href={LAUNCH_ROUTES.whatsapp}
          label={progress.hasWhatsapp ? "Edit WhatsApp" : "Add WhatsApp"}
        >
          <p>
            On your account, add the WhatsApp number buyers should message. A phone number there is for calls. The
            shop button uses the WhatsApp number, or the phone number if WhatsApp is empty.
          </p>
        </Step>

        <Step n={5} id="video" title="Shop video, if you want one" state="optional" href={LAUNCH_ROUTES.video} label="Shop video">
          <p>
            Optional. A clip can be up to {MAX_DURATION_SECONDS} seconds, and only on Verified Pro. Paid upgrades
            coming soon. A free shop cannot upload a video. A video stays private until an admin has watched it and
            approved it. You confirm you have the rights, and the consent of anyone who is shown.
          </p>
        </Step>

        <Step n={6} id="live" title="What happens next" state={stepState("live", progress, current)} href={live.href} label={live.label}>
          <p>
            A directory listing is public after you press Publish. A shop stays a draft until you press Publish shop.
            Then buyers can open it and message you.
          </p>
          <p>
            {badges} are granted by an admin after a check. They are not added when you sign up, and they are not
            something you pay for. A green Verified mark on a listing is a separate admin check.
          </p>
        </Step>
      </ol>

      <section className={`${cardClass} grid gap-3 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Need a hand?</h2>
        {phone && tel ? (
          <a href={`tel:${tel}`} className={actionClass}>
            Call {phone}
          </a>
        ) : null}
        <a href={`mailto:${CONTACT_EMAIL}`} className={`${btnNavy} min-h-12 w-full break-all px-5 text-base`}>
          {CONTACT_EMAIL}
        </a>
      </section>
    </article>
  );
}

function stepTitle(id: GuideStepId) {
  if (id === "account") return "create an account";
  if (id === "shop") return "set up the shop";
  if (id === "listing") return "add the first listing";
  if (id === "whatsapp") return "add a WhatsApp number";
  if (id === "video") return "the shop video";
  return "what happens next";
}

function stepState(id: GuideStepId, progress: GuideProgress, current: GuideStepId | null) {
  if (guideStepDone(id, progress)) return "done" as const;
  if (current === id) return "current" as const;
  return "ready" as const;
}

function Step({
  n,
  id,
  title,
  state,
  href,
  label,
  children,
}: {
  n: number;
  id: GuideStepId;
  title: string;
  state: "done" | "current" | "ready" | "optional";
  href: string;
  label: string;
  children: ReactNode;
}) {
  const current = state === "current";
  return (
    <li
      id={`step-${id}`}
      aria-current={current ? "step" : undefined}
      className={`${cardClass} grid scroll-mt-4 gap-3 p-5 ${current ? "ring-2 ring-navy" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl text-navy">
          <span className="mr-2 text-lake-dark">{n}.</span>
          {title}
        </h2>
        {state === "done" ? <span className="text-sm font-semibold text-lake-dark">Done</span> : null}
        {current ? <span className="text-sm font-semibold text-navy">Start here</span> : null}
        {state === "optional" ? <span className="text-sm font-semibold text-ink">Optional</span> : null}
      </div>
      <div className="grid gap-3 text-base leading-relaxed text-ink">{children}</div>
      <Link href={href} className={state === "done" ? doneClass : actionClass}>
        {label}
      </Link>
    </li>
  );
}
