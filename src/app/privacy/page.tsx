import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";
import { appName } from "@/lib/brand";
import { SEARCH_CACHE_MS } from "@/lib/ai/search-parse";
import { CONTACT_EMAIL, legalEntityLabel, publicInfoPage, verifiedProDurationCopy } from "@/lib/public-info";
import { STAT_RETENTION_DAYS } from "@/lib/stats/retention";
import { VIEW_DEDUPE_MS } from "@/lib/stats/track";
import { REJECT_PURGE_DAYS } from "@/lib/video/constants";

const page = publicInfoPage("/privacy");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

const PROCESSORS = [
  { name: "Vercel", role: "Hosts the website." },
  { name: "Neon", role: "Holds the database of accounts, listings, shops, and the records described below." },
  { name: "Vercel Blob", role: "Stores photos you upload for a listing, an offering, a shop cover, or a profile." },
  { name: "Mux", role: "Stores and plays shop videos, and deletes a video file when we tell it to." },
  {
    name: "Google Gemini",
    role: "Provides AI search and the other AI features when those features are switched on. If a different model provider is configured, the same kinds of text and photos may go there instead.",
  },
  {
    name: "Flutterwave",
    role: "Takes payment for Featured and Verified Pro. Card numbers and the M-Pesa prompt stay with Flutterwave.",
  },
  {
    name: "ZeptoMail",
    role: "Sends optional weekly seller-tip emails, and only when that feature is switched on and the seller has asked for them.",
  },
] as const;

export default function PrivacyPage() {
  const name = appName();
  const viewMinutes = Math.round(VIEW_DEDUPE_MS / 60_000);
  const searchCacheDays = Math.round(SEARCH_CACHE_MS / 86_400_000);

  return (
    <InfoPage
      path="/privacy"
      kicker="Privacy"
      title="Privacy"
      lede={`${legalEntityLabel()} is the controller for personal data on ${name}. This note is written for the Kenya Data Protection Act 2019, and for the UK GDPR where you use ${name} from the United Kingdom.`}
    >
      <InfoSection title="Who we are">
        <p>
          The product is called {name}. The controller is {legalEntityLabel()}. For privacy questions, including a
          request to see, correct, or delete your data, write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </InfoSection>

      <InfoSection title="What we collect">
        <p>Account data. When you register we ask for your name, email, a password, whether you are a person or a business, and your city (Nairobi or London). The password is stored as a hash. We do not keep the password itself. You can also add a phone number, a WhatsApp number, a short bio, and a profile photo.</p>
        <p>
          Shop and listing content. That includes titles, descriptions, categories, cities, addresses you choose to
          publish, prices, contact names, and the offerings on a shop. Reviews you write are stored with your name.
          Reports you send, and the people you block, are stored too.
        </p>
        <p>
          Photos and videos. Photos you upload are stored so they can be shown on the listing or shop. A shop video,
          its caption, and the record that you confirmed you had the rights and consent, are stored. The video file
          itself is stored by Mux.
        </p>
        <p>
          View and tap counts. When counting is switched on, we count views of a listing or a shop, and taps on a
          WhatsApp link or a call link. Your browser keeps a random id in a first-party cookie named rangach_visitor,
          and a copy of that id for the browsing session. We do not store the raw id. We store a salted HMAC-SHA256
          hash of it. A secret salt is the key. The same visitor on the same listing or shop is counted once every{" "}
          {viewMinutes} minutes. WhatsApp and call taps are counted when you tap. Automated crawlers are skipped. If
          the salt is not set, we do not store the count. The optional AI features use a separate salted hash of the
          same cookie so we can limit how often a visitor can ask. That hash is not your name.
        </p>
        <p>
          Payment references. For Featured and Verified Pro we store the product, the amount, the currency, the method
          (M-Pesa or card), our payment reference, Flutterwave’s transaction id, and whether the payment is pending,
          paid, failed, or cancelled. We do not store card numbers. Flutterwave handles the card and the M-Pesa prompt.
          An M-Pesa phone number is sent to Flutterwave for that prompt. It is not written on our payment record.
        </p>
        <p>
          The “Buying for family back home” note is written in your browser and opens in WhatsApp. We do not save it.
          If you use the optional sentence helper, that sentence is sent to the AI provider to fill the form, and we
          do not store the sentence.
        </p>
      </InfoSection>

      <InfoSection title="Who processes it">
        <p>These companies process data for us. We do not sell personal data.</p>
        <ul className="grid gap-2">
          {PROCESSORS.map((processor) => (
            <li key={processor.name}>
              <span className="font-semibold text-navy">{processor.name}.</span> {processor.role}
            </li>
          ))}
        </ul>
        <p>
          WhatsApp is not our processor for the chat. When you message a seller, that conversation stays on WhatsApp,
          between you and them. We may only count that you tapped the link, as the salted hash above.
        </p>
      </InfoSection>

      <InfoSection title="Why we use it, and the lawful basis">
        <p>
          Running your account, your shop, your listings, and a Featured or Verified Pro upgrade you asked for. The
          basis is the service you signed up for.
        </p>
        <p>
          Keeping the site safe: scam checks on listing text, reports, blocks, and admin review of shop videos. An AI
          moderation pass, when it is switched on, can flag a listing for an admin. It does not hide or delete the
          listing by itself. The basis is our legitimate interest in a directory people can trust, and, where the law
          requires a step, our legal duty.
        </p>
        <p>
          Understanding which listings are opened and which contact buttons are used, so a seller can see simple
          counts. The basis is our legitimate interest in knowing the directory is used. We use the salted hash
          instead of your name.
        </p>
        <p>
          Optional tools that need a yes from you. The listing writer sends the sentence you type, and a photo if you
          attached one, to the AI service, and only after you agree. The draft is saved on your account so you can
          use it. You check it before anything is published. Weekly seller tips are emailed only if you opt in. A shop
          video is uploaded only if you tick the rights and consent box. You can say no and still use the rest of{" "}
          {name}.
        </p>
        <p>
          Search can read a sentence with ordinary rules and never call a model. When AI search is switched on, the
          sentence may be sent to the model. We store a hash of the sentence and the filters we understood, not a
          profile of you, for {searchCacheDays} days.
        </p>
      </InfoSection>

      <InfoSection title="How long we keep it">
        <p>
          View and tap counts are deleted after {STAT_RETENTION_DAYS} days. A rejected shop video is removed from Mux
          after {REJECT_PURGE_DAYS} days. We keep the rejection note and the poster image. A search-result cache lasts{" "}
          {searchCacheDays} days.
        </p>
        <p>
          Accounts, listings, photos, shop pages, payment records, and AI listing drafts stay while the account is in
          use. We have not set a shorter automatic deletion date for those. {verifiedProDurationCopy()} Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>{" "}
          if you want your account or a draft deleted. We may keep a payment record, or a report, for longer where we
          need it for a legal claim or a duty under Kenyan or UK law.
        </p>
      </InfoSection>

      <InfoSection title="Your rights">
        <p>
          You can ask for access to the personal data we hold, for a correction, for deletion, for a restriction, or
          for a copy you can take elsewhere (portability). You can object to a use that is based on legitimate
          interests, including the view and tap counts. You can withdraw consent for optional AI drafts and for seller
          tip emails. Tip emails also include an unsubscribe link, and the choice sits on your account under Your week.
        </p>
        <p>
          You can edit your profile, shop, and listings while you are signed in. There is not yet a button that
          downloads or deletes the whole account. Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>{" "}
          and we will handle the request. We may need to confirm it is you.
        </p>
        <p>
          You can complain to the Office of the Data Protection Commissioner in Kenya, and, if you are in the United
          Kingdom, to the Information Commissioner’s Office (ICO). You can do that whether or not you have written to
          us first.
        </p>
      </InfoSection>

      <InfoSection title="Transfers out of Kenya and the UK">
        <p>
          Vercel, Neon, Vercel Blob, Mux, Google Gemini, Flutterwave, and ZeptoMail may store or process personal data
          outside Kenya and the United Kingdom. If you use {name} from London, the UK GDPR rules on international
          transfers apply to your personal data as well as the Kenya Data Protection Act. If you use it from Kenya, the
          Act’s rules on cross-border transfers apply.
        </p>
        <p>Ask us at {CONTACT_EMAIL} if you want to know which safeguard covers a particular transfer.</p>
      </InfoSection>

      <InfoSection title="Cookies and sessions">
        <p>
          Signing in uses a session cookie so you stay signed in. That cookie is essential for the account. We do not
          use advertising cookies, and we do not set a third-party analytics cookie.
        </p>
        <p>
          We also set rangach_visitor, described above. It lasts about a year, on this site only, with SameSite=Lax.
          It is there so view and tap counts, and the optional AI limits, can tell one browser from another without
          storing the raw id. You can clear it in your browser. Clearing it starts a new random id. The site still
          works.
        </p>
        <p>
          The install hint remembers, on your device, if you have dismissed it. That uses local storage, not a cookie,
          and it is not sent to us as a profile.
        </p>
      </InfoSection>

      <InfoSection title="Children">
        <p>
          {name} is not aimed at children. Do not open an account for anyone under 18. Do not show a child in a photo
          or a video unless you have the right consent, and do not film children who happen to be nearby. We do not
          knowingly keep an account for a child. If you believe we have, write to {CONTACT_EMAIL} and we will delete
          it.
        </p>
      </InfoSection>

      <InfoSection title="Contact">
        <p>
          {legalEntityLabel()}
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>
        </p>
      </InfoSection>
    </InfoPage>
  );
}
