/**
 * When /account/storefront shows "Publish shop".
 * The button needs one offering that is not archived. It does not check WhatsApp or phone.
 * publishStorefront itself only flips published to true; the page hides the button until an offering exists.
 */
export function publishShopButtonVisible(input: { published: boolean; activeOfferings: number }) {
  return !input.published && input.activeOfferings >= 1;
}
