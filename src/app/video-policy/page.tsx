import type { Metadata } from "next";
import Link from "next/link";
import { cardClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { REJECT_PURGE_DAYS } from "@/lib/video/constants";

const name = appName();

export const metadata: Metadata = {
  title: "Video policy",
  description: `What shop videos on ${name} may show, how approval works, and how to ask for a takedown.`,
};

export default function VideoPolicyPage() {
  return (
    <article className="mx-auto grid max-w-2xl gap-5 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl text-navy">Video policy</h1>
        <p className="mt-2 text-sm text-ink/70">
          A shop on the Pro plan can put one short video on its page. {name} reviews it before anyone else can play it.
        </p>
      </div>
      <section className={`${cardClass} grid gap-3 p-5 text-sm leading-relaxed text-ink/85`}>
        <h2 className="font-serif text-xl text-navy">What you can upload</h2>
        <p>One MP4 or MOV, up to 45 seconds, of your own shop, work, or product. iPhone video is fine.</p>
        <p>You need the rights to the picture and to any music. Do not use a song you do not have rights to.</p>
        <p>Anyone who is shown has to have agreed to be in the video. Do not film customers, children, or passers-by without that consent.</p>
        <p>Do not put phone numbers, prices that are a trick, or other contact spam in the video. Buyers already have WhatsApp on the shop page.</p>
      </section>
      <section className={`${cardClass} grid gap-3 p-5 text-sm leading-relaxed text-ink/85`}>
        <h2 className="font-serif text-xl text-navy">Approval</h2>
        <p>A new upload is private. An admin watches it and either approves it or rejects it with a reason.</p>
        <p>If you upload a replacement, the video already on your shop stays up until the new one is approved. Then the old one is removed.</p>
        <p>
          A rejected video is deleted from the video host after {REJECT_PURGE_DAYS} days. The reason is kept. A video longer than 45
          seconds is deleted straight away.
        </p>
        <p>If the Pro plan is turned off, the video is hidden from the shop and from link previews. It is kept, and it shows again when Pro is on.</p>
      </section>
      <section className={`${cardClass} grid gap-3 p-5 text-sm leading-relaxed text-ink/85`}>
        <h2 className="font-serif text-xl text-navy">Takedown and reports</h2>
        <p>
          If a video uses you, your music, or your work without permission, sign in and use <span className="font-semibold">Report this shop</span> on
          that shop page. Say that it is about the video, and why.
        </p>
        <p>An admin can take a live video down. It is removed from the shop immediately.</p>
        <p>
          <Link href="/listings" className="font-semibold text-lake-dark hover:text-lake">
            Back to the directory
          </Link>
        </p>
      </section>
    </article>
  );
}