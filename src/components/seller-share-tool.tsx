"use client";

import { useMemo, useState } from "react";
import { btnPrimary, btnSecondary, cardClass, fieldClass } from "@/components/ui";
import {
  buildAllCaptions,
  coachingTips,
  tipCardText,
  type ShareSubject,
  type ShareTarget,
} from "@/lib/seller-share/captions";
import { handlesFromShop, type SellerSocialHandles } from "@/lib/seller-share/handles";

const TARGETS: { id: ShareTarget; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "tiktok", label: "TikTok" },
];

export type ShareChoice =
  | { id: string; kind: "shop"; label: string; url: string; city: string; description: string; photoUrl: string }
  | {
      id: string;
      kind: "listing";
      label: string;
      url: string;
      city: string;
      description: string;
      priceLabel: string;
      photoUrl: string;
    };

export function SellerShareTool({
  choices,
  handles,
  cardPath,
}: {
  choices: ShareChoice[];
  handles: SellerSocialHandles;
  cardPath: string;
}) {
  const [selectedId, setSelectedId] = useState(choices[0]?.id ?? "");
  const [target, setTarget] = useState<ShareTarget>("whatsapp");
  const [copied, setCopied] = useState("");

  const selected = choices.find((choice) => choice.id === selectedId) ?? choices[0];
  const subject = useMemo<ShareSubject | null>(() => {
    if (!selected) return null;
    return {
      kind: selected.kind,
      name: selected.label,
      url: selected.url,
      city: selected.city,
      description: selected.description,
      photoUrl: selected.photoUrl,
      priceLabel: selected.kind === "listing" ? selected.priceLabel : undefined,
    };
  }, [selected]);

  const captions = useMemo(() => (subject ? buildAllCaptions(subject, handles) : null), [subject, handles]);
  const tips = useMemo(() => (subject ? coachingTips(subject, handles) : []), [subject, handles]);
  const caption = captions?.[target] ?? "";

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("fail");
    }
  }

  if (!selected || !subject) {
    return (
      <p className="text-sm text-ink/70">
        Publish a shop or add a listing first, then come back for ready captions and a branded card.
      </p>
    );
  }

  const downloadHref = `${cardPath}?kind=${encodeURIComponent(selected.kind)}&id=${encodeURIComponent(selected.id)}`;

  return (
    <div className="grid gap-6">
      <label className="block text-sm font-medium text-ink/80">
        What to share
        <select
          className={fieldClass}
          value={selected.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.kind === "shop" ? `Shop · ${choice.label}` : `Listing · ${choice.label}`}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {TARGETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={target === item.id ? btnPrimary : btnSecondary}
            onClick={() => setTarget(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className={`${cardClass} grid gap-3 p-4`}>
        <h2 className="font-serif text-xl text-navy">Ready caption</h2>
        <p className="text-sm text-ink/65">
          Copy and paste into {TARGETS.find((item) => item.id === target)?.label}. You post yourself — Rangach does not
          connect to your accounts.
        </p>
        <textarea readOnly value={caption} rows={10} className={`${fieldClass} font-mono text-sm`} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => copyText(caption, "caption")}>
            {copied === "caption" ? "Copied" : "Copy caption"}
          </button>
          <a href={downloadHref} className={btnSecondary}>
            Download branded card
          </a>
        </div>
        {copied === "fail" ? <p className="text-sm text-danger">Could not copy. Select the text and copy it.</p> : null}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-xl text-navy">How to post</h2>
        <p className="text-sm text-ink/65">
          Short tips for filming, writing, timing, and putting your Rangach link where people can tap it.
        </p>
        {tips.map((tip) => {
          const card = tipCardText(tip, subject, handles);
          return (
            <article key={tip.id} className={`${cardClass} grid gap-2 p-4`}>
              <h3 className="font-semibold text-navy">{tip.title}</h3>
              <p className="text-sm text-ink/80">{tip.body}</p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-paper px-3 py-2 text-xs text-ink/80">
                {card}
              </pre>
              <button type="button" className={btnSecondary} onClick={() => copyText(card, tip.id)}>
                {copied === tip.id ? "Copied tip" : "Copy tip card"}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

export function emptyHandles(): SellerSocialHandles {
  return handlesFromShop({});
}
