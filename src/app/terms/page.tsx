import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import { FEATURED_DAYS, productLabel } from "@/lib/constants";
import {
  CONTACT_EMAIL,
  LEGAL_ENTITY_NAME,
  featuredDurationCopy,
  paidPriceLine,
  publicInfoPage,
  verifiedProDurationCopy,
} from "@/lib/public-info";
import { MAX_DURATION_SECONDS } from "@/lib/video/constants";

const page = publicInfoPage("/terms");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

export default function TermsPage() {
  const name = appName();

  return (
    <InfoPage
      path="/terms"
      kicker="Seller and user terms"
      title="Terms"
      lede={`These terms cover how people use ${name}. ${LEGAL_ENTITY_NAME} operates the site. If that name is still in brackets, it is a placeholder while the legal name is chosen.`}
    >
      <InfoSection title="What this site is">
        <p>
          {name} is a directory. You can list a business, housing, or a classified, and other people can find you and
          contact you on WhatsApp or by phone. {name} does not book a room, hold goods, or take payment for what a
          buyer and a seller agree between themselves.
        </p>
        <p>
          The only payments {name} takes are for Featured and for Verified Pro. Those are upgrades to a listing or a
          shop on this site. They are not a payment for the goods or the housing.
        </p>
      </InfoSection>

      <InfoSection title="Accurate listings">
        <p>
          If you post a listing, a shop, an offering, a review, or a video, what you post should be true and current.
          Use your own name or business name, a real city, and a price that is the price you mean. Update the listing
          when it changes, and take it down when the thing is gone.
        </p>
        <p>You are responsible for the words, photos, and video on your account. Buyers should still check for themselves before they pay anyone.</p>
      </InfoSection>

      <InfoSection title="Prohibited items">
        <p>Do not post:</p>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>anything illegal in Kenya or in the United Kingdom</li>
          <li>a scam, a fake business, or a listing that asks for money before a meeting or an inspection</li>
          <li>a request for gift cards, cryptocurrency, or a wire transfer such as Western Union or MoneyGram</li>
          <li>a promise of guaranteed profit, or an investment pitch dressed up as a listing</li>
          <li>photos, video, or music you do not have the rights to use</li>
          <li>a person, including a child or a passer-by, who has not agreed to be shown</li>
          <li>harassment, spam, or phone numbers and prices stuffed into a shop video</li>
        </ul>
        <p>
          An automatic check can flag risky wording, such as a demand to pay first. It does not catch everything. An
          admin decides what happens next.
        </p>
      </InfoSection>

      <InfoSection title="Photos, video, consent, and rights">
        <p>
          You keep ownership of the photos and video you upload. You give {name} permission to store them, show them
          on the site, and use them in link previews, for as long as the listing or shop is up and as described in the
          privacy note.
        </p>
        <p>
          You confirm that you have the rights to every photo and to any music in a video, and that anyone who is
          shown has agreed. Do not film customers, children, or passers-by without that consent. A shop video is one
          clip of up to {MAX_DURATION_SECONDS} seconds, and it stays private until an admin approves it. The{" "}
          <Link href="/video-policy" className="font-semibold text-lake-dark hover:text-lake">
            video policy
          </Link>{" "}
          is part of these terms.
        </p>
      </InfoSection>

      <InfoSection title="Moderation and removal">
        <p>
          We may review listings, shops, reviews, photos, and videos. We may hide a listing, reject or take down a
          video, remove a verification badge, or turn the Pro plan off. We may do that if something breaks these
          terms, if someone reports it, or if we need to protect other people.
        </p>
        <p>
          Hiding a listing removes it from public browse. It does not by itself delete your account. Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>{" "}
          if you think we made a mistake.
        </p>
      </InfoSection>

      <InfoSection title="Paid upgrades">
        <p>
          {productLabel("featured")} is {paidPriceLine("featured")}. {featuredDurationCopy()} It is {FEATURED_DAYS}{" "}
          days, for one listing, and it does not verify that listing.
        </p>
        <p>
          {productLabel("verified_pro")} is {paidPriceLine("verified_pro")}. {verifiedProDurationCopy()}
        </p>
        <p>
          You pay the price shown at checkout for the city that applies: the listing’s city for Featured, and the city
          on your account for Verified Pro. Flutterwave collects it, by M-Pesa where the price is in shillings, or by
          card. We do not store your card number.
        </p>
        <p>
          We do not refund a Featured or Verified Pro payment, except where the law requires a refund. Paying does not
          buy a verification badge.
        </p>
      </InfoSection>

      <InfoSection title="Deals are between buyers and sellers">
        <p>
          {name} is not a party to a deal between a buyer and a seller. We do not hold the money for goods, housing, or
          a service. We do not deliver, and we do not guarantee that a person will reply, that an item is as described,
          or that a shop is who it says it is.
        </p>
        <p>
          A verification badge means only what that badge says: an admin checked a phone, a place, or a business, by
          the method and on the date shown. It is not a promise about a later deal. The Pro plan is a paid plan, not a
          check.
        </p>
        <p>
          WhatsApp is a separate service. When you message a seller, that chat is between you and them. {name} does not
          see it.
        </p>
      </InfoSection>

      <InfoSection title="Liability">
        <p>
          To the extent the law allows, {name} is not liable for loss that comes from a listing being wrong, from a
          meeting, or from a payment or a delivery between users. We are also not liable for indirect or unexpected
          loss, or for a shop video or photo someone else uploaded.
        </p>
        <p>
          Nothing here excludes liability that the law does not let us exclude. That includes liability for fraud, and
          for death or personal injury caused by negligence. If you use {name} from the United Kingdom, you keep any
          rights that UK law does not let a contract take away.
        </p>
      </InfoSection>

      <InfoSection title="Governing law">
        <p>
          These terms are governed by the laws of Kenya. The courts of Kenya can hear disputes about them, except where
          a law where you live says a consumer claim must be heard somewhere else.
        </p>
      </InfoSection>

      <InfoSection title="Contact">
        <p>
          {LEGAL_ENTITY_NAME}
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>
        </p>
      </InfoSection>
    </InfoPage>
  );
}
