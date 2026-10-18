import { CITIES } from "@/lib/constants";

export function TownOptions({
  includeDiaspora = true,
  blank = "",
}: {
  includeDiaspora?: boolean;
  blank?: string;
}) {
  const cities = CITIES.filter((city) => includeDiaspora || city.region === "homeland");
  return (
    <>
      {blank ? <option value="">{blank}</option> : null}
      {cities.map((city) => (
        <option key={city.name} value={city.name}>
          {city.region === "diaspora" ? `${city.name} — Diaspora` : city.name}
        </option>
      ))}
    </>
  );
}
