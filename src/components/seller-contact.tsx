import Link from "next/link";
import { FamilyOrderButton } from "@/components/family-order-button";
import { btnSecondary, btnWhatsApp } from "@/components/ui";
import { MPESA_SAFETY_NOTE } from "@/lib/safety";

/** Understated line in place of a demo shop's placeholder phone and WhatsApp. */
export function DemoContactNote({ note }: { note: string }) {
  return <p className="mt-2 text-sm text-ink/55">{note}</p>;
}

/** One line beside a WhatsApp or call button. */
export function PaymentSafetyNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-ink/60 ${className}`}>
      {MPESA_SAFETY_NOTE}{" "}
      <Link href="/safety" className="font-semibold text-lake-dark hover:text-lake">
        Safety tips
      </Link>
    </p>
  );
}

/**
 * WhatsApp, call, and visible numbers for a real seller.
 * When `hidden` is set, none of the phone fields or links are rendered.
 */
export function SellerContactChannels({
  hidden,
  note,
  intro,
  phone,
  whatsapp,
  chatUrl,
  callUrl,
  family,
}: {
  hidden: boolean;
  note: string;
  intro?: string;
  phone?: string;
  whatsapp?: string;
  chatUrl?: string;
  callUrl?: string;
  family?: { phone: string; subjectName: string; path: string; siteName: string } | null;
}) {
  if (hidden) return <DemoContactNote note={note} />;
  return (
    <>
      {intro ? <p className="mt-1 text-sm text-ink/60">{intro}</p> : null}
      <div className="mt-3 hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap">
        {chatUrl ? (
          <a href={chatUrl} className={btnWhatsApp} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        ) : null}
        {family?.phone ? (
          <FamilyOrderButton
            phone={family.phone}
            subjectName={family.subjectName}
            path={family.path}
            siteName={family.siteName}
          />
        ) : null}
        {callUrl ? (
          <a href={callUrl} className={btnSecondary}>
            Call
          </a>
        ) : null}
      </div>
      <PaymentSafetyNote className="mt-3" />
      <div className="mt-3 text-sm text-ink/65">
        {phone ? <p>Phone {phone}</p> : null}
        {whatsapp ? <p>WhatsApp {whatsapp}</p> : null}
      </div>
    </>
  );
}
