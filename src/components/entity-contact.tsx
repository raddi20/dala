import { telHref } from "@/lib/utils";
import {
  CONTACT_EMAIL,
  legalEntityLabel,
  legalEntityOwnerLine,
  publicBusinessAddress,
  publicBusinessPhone,
  publicBusinessPhoneTel,
} from "@/lib/public-info";

type EntityContactProps = {
  owner?: string;
  address?: string;
  phone?: string;
  phoneTel?: string;
};

/** Controller name, and phone, address, or owner only when those constants are filled in. */
export function EntityContact(props: EntityContactProps) {
  const owner = props.owner ?? legalEntityOwnerLine();
  const address = props.address ?? publicBusinessAddress();
  const phone = props.phone ?? publicBusinessPhone();
  const rawTel = props.phoneTel ?? (props.phone === undefined ? publicBusinessPhoneTel() : "");
  const call = phone ? (rawTel ? `tel:${rawTel.replace(/^tel:/, "")}` : telHref(phone)) : "";

  return (
    <p>
      {legalEntityLabel()}
      {owner ? (
        <>
          <br />
          {owner}
        </>
      ) : null}
      {address ? (
        <>
          <br />
          <span className="whitespace-pre-wrap">{address}</span>
        </>
      ) : null}
      {call ? (
        <>
          <br />
          <a href={call} className="font-semibold text-lake-dark hover:text-lake">
            {phone}
          </a>
        </>
      ) : null}
      <br />
      <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-semibold text-lake-dark hover:text-lake">
        {CONTACT_EMAIL}
      </a>
    </p>
  );
}
