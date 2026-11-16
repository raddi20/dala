import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { RegisterForm } from "@/components/auth-forms";
import { RecruiterRefField, RecruiterRefPersist } from "@/components/recruiter-ref-field";
import { btnPrimary, cardClass } from "@/components/ui";
import { createStorefront } from "@/lib/actions/storefront";
import { prisma } from "@/lib/prisma";
import { RECRUITER_COOKIE, recruiterCodeFromVisit } from "@/lib/recruiter";
import { getSessionUser } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = {
  title: "List your shop",
  description: "Create an account and open a shop on Rangach. Listing is free. Buyers message you on WhatsApp.",
  alternates: { canonical: "/list-your-shop" },
};

export default async function ListYourShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const code = recruiterCodeFromVisit(one(params.ref), jar.get(RECRUITER_COOKIE)?.value);
  const user = await getSessionUser();
  let invitedBy: string | null = null;
  if (code) {
    try {
      const recruiter = await prisma.recruiter.findUnique({
        where: { code },
        select: { name: true, active: true },
      });
      if (recruiter?.active) invitedBy = recruiter.name;
    } catch {
      invitedBy = null;
    }
  }
  const shop = user
    ? await prisma.storefront.findUnique({
        where: { userId: user.id },
        select: { slug: true },
      })
    : null;

  return (
    <div className="mx-auto grid max-w-md gap-6 px-4 py-10">
      <RecruiterRefPersist serverValue={code} />
      <header>
        <h1 className="font-serif text-3xl text-navy">List your shop</h1>
        <p className="mt-3 text-base leading-relaxed text-ink/80">
          Listing is free. Create an account, then start the shop. Buyers message you on WhatsApp.
        </p>
        {invitedBy ? (
          <p className="mt-3 rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark" role="status">
            {invitedBy} invited you to list your shop.
          </p>
        ) : code ? (
          <p className="mt-3 text-sm text-ink/60">Referral: {code}</p>
        ) : null}
      </header>

      {shop ? (
        <section className={`${cardClass} grid gap-3 p-5`}>
          <h2 className="font-serif text-2xl text-navy">Your shop is open</h2>
          <p className="text-sm text-ink/70">The shop page is where you add what you sell and publish.</p>
          <Link href="/account/storefront" className={btnPrimary}>
            Go to your shop
          </Link>
        </section>
      ) : user ? (
        <section className={`${cardClass} grid gap-3 p-5`}>
          <h2 className="font-serif text-2xl text-navy">Start your shop</h2>
          <p className="text-sm text-ink/70">
            Shop name will be <span className="font-semibold text-navy">{user.name}</span>. The shop stays a draft until
            you publish it.
          </p>
          <form action={createStorefront}>
            <RecruiterRefField serverValue={code} />
            <button className={btnPrimary}>Start your shop</button>
          </form>
        </section>
      ) : (
        <section className={`${cardClass} grid gap-4 p-5`}>
          <h2 className="font-serif text-2xl text-navy">Create an account</h2>
          <p className="text-sm text-ink/70">After this, you come back here to start the shop. It is free.</p>
          <RegisterForm nextPath="/list-your-shop" />
        </section>
      )}
    </div>
  );
}
