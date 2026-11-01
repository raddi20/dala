import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import { MPESA_SAFETY_NOTE, MPESA_TIPS, SAFETY_TIPS, VERIFICATION_EXPLAINER, safetyTipText } from "@/lib/safety";
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
      <InfoSection title="What verified means">
        <div id="verified" className="scroll-mt-24 space-y-3">
          <p>{VERIFICATION_EXPLAINER.intro}</p>
          <ul className="space-y-2">
            {VERIFICATION_EXPLAINER.points.map((point) => (
              <li key={point.label}>
                <span className="font-semibold text-ink">{point.label}.</span> {point.body}
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 pl-5">
            {VERIFICATION_EXPLAINER.limits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </InfoSection>
      <InfoSection title="M-Pesa tips for buyers">
        <ul id="mpesa" className="scroll-mt-24 list-disc space-y-1 pl-5">
          {MPESA_TIPS.buyers.map((line) => (
            <li key={line}>{safetyTipText(line, name)}</li>
          ))}
        </ul>
      </InfoSection>
      <InfoSection title="M-Pesa tips for sellers">
        <ul className="list-disc space-y-1 pl-5">
          {MPESA_TIPS.sellers.map((line) => (
            <li key={line}>{safetyTipText(line, name)}</li>
          ))}
        </ul>
      </InfoSection>
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
