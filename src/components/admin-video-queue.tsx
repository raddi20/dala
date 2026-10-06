import Link from "next/link";
import { ShopVideoPoster } from "@/components/shop-video-poster";
import { btnDanger, btnSecondary, fieldClass } from "@/components/ui";
import { approveShopVideoAction, rejectShopVideoAction, removeLiveShopVideoAction } from "@/lib/actions/video";
import { getVideoBackend } from "@/lib/video/backend";
import { videoMode } from "@/lib/video/config";
import { signedPosterUrl } from "@/lib/video/machine";
import { purgeExpiredVideos } from "@/lib/video/service";
import { isProActive } from "@/lib/pro";
import { prisma } from "@/lib/prisma";

function when(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export async function AdminVideoQueue({ notice }: { notice: string }) {
  const mode = videoMode();
  const backend = await getVideoBackend();
  if (backend) await purgeExpiredVideos(prisma, backend);

  const [pendingRows, live, events] = await Promise.all([
    prisma.shopVideo.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        storefront: {
          select: { slug: true, user: { select: { name: true, email: true, verifiedPro: true, verifiedProUntil: true } } },
        },
      },
    }),
    prisma.shopVideo.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        storefront: { select: { slug: true, user: { select: { name: true, verifiedPro: true, verifiedProUntil: true } } } },
      },
    }),
    prisma.shopVideoEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { storefront: { select: { slug: true, user: { select: { name: true } } } } },
    }),
  ]);

  const pending = await Promise.all(
    pendingRows.map(async (video) => {
      const tokens =
        backend && video.playbackId && mode === "live" ? await backend.signReviewTokens(video.playbackId) : null;
      const poster =
        mode === "mock"
          ? video.posterUrl || "/mock/shop-poster.jpg"
          : tokens
            ? signedPosterUrl(video.playbackId, tokens.thumbnail)
            : "";
      return { video, tokens, poster };
    }),
  );

  return (
    <section id="shop-videos" className="grid gap-3">
      <h2 className="font-serif text-2xl">Shop videos</h2>
      <p className="text-sm text-ink/70">
        New uploads stay private until you approve them. Approving a replacement takes down the old video. A rejection
        needs a reason and is kept here. The seller sees the result on Manage storefront. No email is sent.
      </p>
      {mode === "off" ? <p className="text-sm text-ink/70">Shop video is not configured on this deploy.</p> : null}
      {notice ? (
        <p className="rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark" role="status">
          {notice}
        </p>
      ) : null}
      {pending.length === 0 ? <p className="text-sm text-ink/70">No videos are waiting for review.</p> : null}
      {pending.map(({ video, tokens, poster }) => (
          <article key={video.id} className="grid gap-3 rounded-2xl border border-sand bg-card p-4 text-sm">
            <div>
              <Link href={`/b/${video.storefront.slug}`} className="font-semibold">
                {video.storefront.user.name}
              </Link>
              <p className="text-ink/70">
                /b/{video.storefront.slug} · {video.storefront.user.email}
                {isProActive(video.storefront.user) ? "" : " · Pro plan is off, so a public video would stay hidden"}
              </p>
              {video.caption ? <p className="mt-1">{video.caption}</p> : null}
              <p className="text-ink/60">
                {video.durationSeconds ? `${Math.round(video.durationSeconds)} seconds` : "Length not reported"} · consent{" "}
                {video.consentAt ? when(video.consentAt) : "missing"}
              </p>
              {video.aiStatus ? (
                <p className="mt-2 rounded-xl bg-paper px-3 py-2 text-ink/80">
                  Automatic check ({video.aiStatus}): {video.aiDetail || "No detail."} A person still approves or rejects.
                </p>
              ) : null}
            </div>
            {video.playbackId ? (
              <ShopVideoPoster
                playbackId={video.playbackId}
                posterUrl={poster}
                caption={video.caption}
                mock={mode === "mock"}
                tokens={tokens ?? undefined}
              />
            ) : (
              <p className="text-ink/60">The preview is not ready yet.</p>
            )}
            {mode === "live" && video.playbackId && !tokens ? (
              <p className="text-ink/60">Add the Mux signing key to play this private video. You can still approve or reject it.</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <form action={approveShopVideoAction}>
                <input type="hidden" name="videoId" value={video.id} />
                <button className={btnSecondary} type="submit">
                  Approve
                </button>
              </form>
              <form action={rejectShopVideoAction} className="grid flex-1 gap-2 sm:min-w-64">
                <input type="hidden" name="videoId" value={video.id} />
                <label className="text-ink/80" htmlFor={`reject-${video.id}`}>
                  Reason for rejection
                  <input id={`reject-${video.id}`} name="reason" required minLength={3} maxLength={500} className={fieldClass} placeholder="Why this video is not going on the shop" />
                </label>
                <button className={btnDanger} type="submit">
                  Reject
                </button>
              </form>
            </div>
          </article>
      ))}

      {live.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="font-semibold">Live videos</h3>
          {live.map((video) => (
            <form key={video.id} action={removeLiveShopVideoAction} className="grid gap-2 rounded-xl border border-sand bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="videoId" value={video.id} />
              <label className="text-ink/80" htmlFor={`remove-${video.id}`}>
                {video.storefront.user.name} · /b/{video.storefront.slug}
                {isProActive(video.storefront.user) ? "" : " · hidden, Pro is off"}
                <input id={`remove-${video.id}`} name="reason" required minLength={3} maxLength={500} className={fieldClass} placeholder="Reason for taking this video down" />
              </label>
              <button className={btnDanger} type="submit">
                Remove
              </button>
            </form>
          ))}
        </div>
      ) : null}

      <div className="grid gap-2">
        <h3 className="font-semibold">Video audit trail</h3>
        {events.length === 0 ? <p className="text-sm text-ink/60">No video changes yet.</p> : null}
        <ol className="grid gap-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
              <p>
                <time dateTime={event.createdAt.toISOString()}>{when(event.createdAt)}</time>
                {" · "}
                {event.action} · {event.storefront.user.name}
                {event.adminName ? ` by ${event.adminName}` : ""}
                {event.adminEmail ? ` (${event.adminEmail})` : ""}
              </p>
              {event.note ? <p className="mt-1 text-ink/75">{event.note}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
