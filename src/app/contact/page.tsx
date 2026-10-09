import type { Metadata } from "next";
import Link from "next/link";
import { EntityContact } from "@/components/entity-contact";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import { publicInfoPage } from "@/lib/public-info";

const page = publicInfoPage("/contact");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

export default function ContactPage() {
  const name = appName();

  return (
    <InfoPage
      path="/contact"
      kicker="Contact"
      title="Contact"
      lede={`Write to ${name} about a listing, a shop, your account, or a payment for Featured or Verified Pro.`}
    >
      <InfoSection title="How to reach us">
        <EntityContact />
        <p>
          {name} is a directory. Buyers and sellers arrange goods, housing, and services themselves, usually on
          WhatsApp. {name} does not take those payments, and it cannot refund them.
        </p>
        <p>
          For a Featured or Verified Pro charge, include the account email, the payment reference, and the date. The{" "}
          <Link href="/refund" className="font-semibold text-lake-dark hover:text-lake">
            refund and cancellation page
          </Link>{" "}
          says what can be refunded. Prices are on the{" "}
          <Link href="/pricing" className="font-semibold text-lake-dark hover:text-lake">
            pricing page
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
