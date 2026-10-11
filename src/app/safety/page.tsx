import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import { MPESA_SAFETY_NOTE, SAFETY_TIPS, safetyTipText } from "@/lib/safety";
import { publicInfoPage } from "@/lib/public-info";

const page = publicInfoPage("/safety");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

export default function SafetyPage() {
  const name = appName();
  return (
    <InfoPage
      path="/safety"
      kicker="Safety"
      title="Paying a seller"
      lede={`${MPESA_SAFETY_NOTE} ${name} does not hold the money for goods.`}
    >
      {SAFETY_TIPS.map((tip) => (
        <InfoSection key={tip.title} title={tip.title}>
          <p>{safetyTipText(tip.body, name)}</p>
        </InfoSection>
      ))}
      <InfoSection title="If something is wrong">
        <p>
          Open the shop or the listing and use Report. You can also read the{" "}
          <Link href="/faq" className="font-semibold text-lake-dark hover:text-lake">
            FAQ
          </Link>{" "}
          and the{" "}
          <Link href="/terms" className="font-semibold text-lake-dark hover:text-lake">
            Terms
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
