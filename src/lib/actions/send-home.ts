"use server";

import { SEND_HOME_THANKS, takeWaitlist } from "@/lib/send-home";
import { clientAddress } from "@/lib/client-address";
import { limitDiasporaWaitlist } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { field, type ActionState } from "@/lib/validators";

export async function joinSendHome(_state: ActionState, formData: FormData): Promise<ActionState> {
  const baskets = formData.getAll("baskets").filter((value): value is string => typeof value === "string");
  const result = await takeWaitlist({
    fields: {
      name: field(formData, "name"),
      email: field(formData, "email"),
      country: field(formData, "country"),
      countryOther: field(formData, "countryOther"),
      homeArea: field(formData, "homeArea"),
      homeAreaOther: field(formData, "homeAreaOther"),
      baskets,
      whatsapp: field(formData, "whatsapp"),
      consent: field(formData, "consent"),
    },
    ip: await clientAddress(),
    limit: (ip) => limitDiasporaWaitlist(ip),
    create: async (draft) => {
      await prisma.diasporaWaitlist.create({ data: draft });
    },
  });
  if (!result.ok) return { error: result.error, field: result.field };
  return { error: "", ok: true, message: SEND_HOME_THANKS };
}
