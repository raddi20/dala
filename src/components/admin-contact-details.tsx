import Link from "next/link";
import { sellerMailto, sellerWhatsappHref } from "@/lib/admin-contact";

export type AdminOwnerContact = {
  email: string;
  phone: string;
  whatsapp: string;
};

export type AdminListingContact = {
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
};

function shown(value: string) {
  const text = value.trim();
  return text || "(empty)";
}

/**
 * Owner login email and stored numbers. Admin pages only.
 * Public listing, shop, profile, Open Graph, and structured data must not render this.
 */
export function AdminContactDetails({
  owner,
  listing,
  editHref,
  open = false,
}: {
  owner: AdminOwnerContact;
  listing?: AdminListingContact;
  editHref?: string;
  open?: boolean;
}) {
  const mail = sellerMailto(owner.email);
  const chat = sellerWhatsappHref(
    listing?.contactWhatsapp,
    listing?.contactPhone,
    owner.whatsapp,
    owner.phone,
  );
  return (
    <details className="rounded-xl border border-sand bg-white px-3 py-2" open={open ? true : undefined}>
      <summary className="cursor-pointer font-semibold">Contact details</summary>
      <div className="mt-2 grid gap-1 text-sm">
        <p>
          <span className="text-ink/60">Owner email</span> {shown(owner.email)}
        </p>
        <p>
          <span className="text-ink/60">Account phone</span> {shown(owner.phone)}
        </p>
        <p>
          <span className="text-ink/60">Account WhatsApp</span> {shown(owner.whatsapp)}
        </p>
        {listing ? (
          <>
            <p>
              <span className="text-ink/60">Listing contact name</span> {shown(listing.contactName)}
            </p>
            <p>
              <span className="text-ink/60">Listing phone</span> {shown(listing.contactPhone)}
            </p>
            <p>
              <span className="text-ink/60">Listing WhatsApp</span> {shown(listing.contactWhatsapp)}
            </p>
          </>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3">
          <p className="w-full font-semibold">Contact seller</p>
          {mail ? (
            <a href={mail} className="font-semibold text-lake-dark underline">
              Email
            </a>
          ) : null}
          {chat ? (
            <a href={chat} className="font-semibold text-lake-dark underline" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
        </div>
        {editHref ? (
          <p className="mt-1">
            <Link href={editHref} className="font-semibold text-lake-dark underline">
              Edit
            </Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}
