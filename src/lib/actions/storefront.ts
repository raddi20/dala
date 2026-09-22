"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { offeringCap } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { uniqueSlug } from "@/lib/storefront";
import { field, parseOfferingForm, parseStorefrontForm, type ActionState } from "@/lib/validators";

async function revalidateShop(userId: string, slug: string, previousSlug?: string) {
  revalidatePath("/account");
  revalidatePath("/account/storefront");
  revalidatePath(`/people/${userId}`);
  revalidatePath(`/b/${slug}`);
  if (previousSlug && previousSlug !== slug) revalidatePath(`/b/${previousSlug}`);
  revalidatePath("/");
  revalidatePath("/listings");
  const listings = await prisma.listing.findMany({ where: { ownerId: userId }, select: { id: true } });
  for (const listing of listings) {
    revalidatePath(`/listings/${listing.id}`);
    revalidatePath(`/listings/${listing.id}/edit`);
  }
}

async function requireUserShop() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/storefront");
  const storefront = await prisma.storefront.findUnique({ where: { userId: user.id } });
  if (!storefront) redirect("/account/storefront");
  return { user, storefront };
}

async function requireOwnedOffering(id: string) {
  const { user, storefront } = await requireUserShop();
  const offering = await prisma.offering.findUnique({ where: { id } });
  if (!offering || offering.storefrontId !== storefront.id) redirect("/account/storefront");
  return { user, storefront, offering };
}

function capMessage(verifiedPro: boolean) {
  const cap = offeringCap(verifiedPro);
  if (verifiedPro) return `Verified Pro shops can list ${cap} offerings.`;
  return `Free shops can list ${cap} offerings. Verified Pro raises that to 20.`;
}

export async function createStorefront() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account/storefront");
  const existing = await prisma.storefront.findUnique({ where: { userId: user.id } });
  if (existing) redirect("/account/storefront");

  const slug = await uniqueSlug(user.name);
  await prisma.storefront.create({
    data: { userId: user.id, slug, published: false },
  });
  await revalidateShop(user.id, slug);
  redirect("/account/storefront?notice=created");
}

export async function updateStorefront(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "Sign in to edit your shop." };
  const storefront = await prisma.storefront.findUnique({ where: { userId: user.id } });
  if (!storefront) return { error: "Start your shop first." };

  const parsed = parseStorefrontForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const taken = await prisma.storefront.findUnique({ where: { slug: parsed.data.slug } });
  if (taken && taken.id !== storefront.id) return { error: "That shop address is already taken." };

  const bannerUrl = user.verifiedPro ? parsed.data.bannerUrl : storefront.bannerUrl;

  try {
    await prisma.$transaction([
      prisma.storefront.update({
        where: { id: storefront.id },
        data: {
          slug: parsed.data.slug,
          bannerUrl,
          published: parsed.data.published,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { bio: parsed.data.bio },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That shop address is already taken." };
    }
    throw error;
  }

  await revalidateShop(user.id, parsed.data.slug, storefront.slug);
  redirect("/account/storefront?notice=saved");
}

export async function createOffering(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, storefront } = await requireUserShop();
  const parsed = parseOfferingForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const cap = offeringCap(user.verifiedPro);
  const active = await prisma.offering.count({ where: { storefrontId: storefront.id, archived: false } });
  if (active >= cap) return { error: capMessage(user.verifiedPro) };

  const max = await prisma.offering.aggregate({
    where: { storefrontId: storefront.id },
    _max: { sortOrder: true },
  });

  await prisma.offering.create({
    data: {
      storefrontId: storefront.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      currency: parsed.data.currency,
      imageUrl: parsed.data.imageUrl,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });

  await revalidateShop(user.id, storefront.slug);
  redirect(`/account/storefront?notice=${active === 0 ? "first" : "offering"}`);
}

export async function publishStorefront() {
  const { user, storefront } = await requireUserShop();
  if (!storefront.published) {
    await prisma.storefront.update({ where: { id: storefront.id }, data: { published: true } });
  }
  await revalidateShop(user.id, storefront.slug);
  redirect("/account/storefront?notice=published");
}

export async function updateOffering(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = field(formData, "id");
  const { user, storefront, offering } = await requireOwnedOffering(id);
  const parsed = parseOfferingForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.offering.update({
    where: { id: offering.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      currency: parsed.data.currency,
      imageUrl: parsed.data.imageUrl,
    },
  });

  await revalidateShop(user.id, storefront.slug);
  redirect("/account/storefront?notice=offering");
}

export async function archiveOffering(formData: FormData) {
  const { user, storefront, offering } = await requireOwnedOffering(field(formData, "id"));
  if (!offering.archived) {
    await prisma.offering.update({ where: { id: offering.id }, data: { archived: true } });
  }
  await revalidateShop(user.id, storefront.slug);
  redirect("/account/storefront?notice=archived");
}

export async function restoreOffering(formData: FormData) {
  const { user, storefront, offering } = await requireOwnedOffering(field(formData, "id"));
  if (offering.archived) {
    const cap = offeringCap(user.verifiedPro);
    const active = await prisma.offering.count({ where: { storefrontId: storefront.id, archived: false } });
    if (active >= cap) redirect("/account/storefront?notice=cap");
    const max = await prisma.offering.aggregate({
      where: { storefrontId: storefront.id, archived: false },
      _max: { sortOrder: true },
    });
    await prisma.offering.update({
      where: { id: offering.id },
      data: { archived: false, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }
  await revalidateShop(user.id, storefront.slug);
  redirect("/account/storefront?notice=restored");
}

export async function moveOffering(formData: FormData) {
  const direction = field(formData, "direction");
  if (direction !== "up" && direction !== "down") redirect("/account/storefront");
  const { user, storefront, offering } = await requireOwnedOffering(field(formData, "id"));
  if (offering.archived) redirect("/account/storefront");

  const items = await prisma.offering.findMany({
    where: { storefrontId: storefront.id, archived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const index = items.findIndex((item) => item.id === offering.id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) redirect("/account/storefront");

  const next = [...items];
  const [moved] = next.splice(index, 1);
  if (!moved) redirect("/account/storefront");
  next.splice(target, 0, moved);
  await prisma.$transaction(
    next.map((item, sortOrder) => prisma.offering.update({ where: { id: item.id }, data: { sortOrder } })),
  );

  await revalidateShop(user.id, storefront.slug);
  redirect("/account/storefront");
}
