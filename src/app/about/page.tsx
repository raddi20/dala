import type { Metadata } from "next";
import { InfoPage, InfoSection } from "@/components/info-page";
import { APP_TAGLINE, appName } from "@/lib/brand";
import { CITIES, FREE_OFFERING_CAP, regionLabel } from "@/lib/constants";
import { CONTACT_EMAIL, publicInfoPage } from "@/lib/public-info";

const page = publicInfoPage("/about");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

export default function AboutPage() {
  const name = appName();
  const places = CITIES.map((city) => `${city.name} (${regionLabel(city.region)}, ${city.country})`);
  const placeList = places.length === 1 ? places[0] : `${places.slice(0, -1).join(", ")} and ${places[places.length - 1]}`;

  return (
    <InfoPage
      path="/about"
      kicker={name}
      title="About"
      lede={`${name} means the gate to a homestead in Dholuo. ${APP_TAGLINE}`}
    >
      <InfoSection title="What Rangach is">
        <p>
          {name} is a directory of Luo-owned businesses, housing, and classifieds for {placeList}. You can browse a
          shop, a room, something for sale, or a service, then talk to the person who posted it.
        </p>
        <p>
          Buyers contact sellers directly on WhatsApp, or by a phone call when a number is listed. There is no booking
          through {name}, and there is no payment through {name} for the goods, the housing, or the service. That
          arrangement stays between the buyer and the seller.
        </p>
      </InfoSection>
      <InfoSection title="Listing is free">
        <p>
          Putting a business or a classified on {name} is free. A free shop can list {FREE_OFFERING_CAP} offerings.
          Sellers who want a louder place in the directory can pay for Featured, or for the Pro shop plan. Those
          payments are for a place on {name}. They are not a payment for the thing being sold, and the Pro plan is not
          a verification badge.
        </p>
        <p>
          The FAQ explains the shop, the badges, shop videos, and buying for family back home. Write to us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
