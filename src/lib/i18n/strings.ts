import { DIASPORA_ORDERS_LABEL } from "@/lib/diaspora";
import { HOME_ASK_PLACEHOLDER } from "@/lib/home-prompts";
import type { Lang } from "@/lib/i18n/lang";

/**
 * Chrome copy only. Listing titles, shop bios, offerings, and reviews stay as the seller wrote them.
 * Kevin signed off the chrome and the guided tour (`draft: false`).
 */
export type UiString = {
  en: string;
  dholuo: string;
  /** True only while a native-speaker answer is still pending. */
  draft: boolean;
  page: string;
  notes: string;
};

export const UI_STRINGS = {
  nav_home: { en: "Home", dholuo: "Dala", draft: false, page: "Bottom nav", notes: "dala is attested as home." },
  nav_explore: { en: "Explore", dholuo: "Manyo", draft: false, page: "Bottom nav", notes: "Review. manyo = look for." },
  nav_ask: { en: "Ask", dholuo: "Penj", draft: false, page: "Bottom nav", notes: "Review. penj = ask." },
  nav_occasions: { en: "Occasions", dholuo: "nyasi", draft: false, page: "Bottom nav", notes: "Review. kinde = a time." },
  nav_sell: { en: "Sell", dholuo: "Uso", draft: false, page: "Bottom nav", notes: "Review. uso = sell." },

  lang_group: { en: "Language", dholuo: "Dhok", draft: false, page: "Language switch", notes: "Review. dhok = language or mouth." },
  lang_en: { en: "EN", dholuo: "EN", draft: false, page: "Language switch", notes: "Keep the short switch label." },
  lang_dholuo: { en: "Dholuo", dholuo: "Dholuo", draft: false, page: "Language switch", notes: "Name of the language." },

  home_ask_title: { en: "Ask Rangach", dholuo: "Penj Rangach", draft: false, page: "Home", notes: "Review penj." },
  home_ask_sub: {
    en: "Shops and classifieds in Kenya, East Africa and the Diaspora. Chat stays on WhatsApp.",
    dholuo: "Duka kod gik ma iuso e Kenya, East Africa kod Diaspora. Twak bedo e WhatsApp.",
    draft: false,
    page: "Home",
    notes: "Review. English keeps the audience line.",
  },
  home_search_label: { en: "Search in a sentence", dholuo: "Many gi wach achiel", draft: false, page: "Home", notes: "Review." },
  ask_placeholder: {
    en: HOME_ASK_PLACEHOLDER,
    dholuo: "chiemo mar ayie Kisumu ne ji 200",
    draft: false,
    page: "Ask Rangach",
    notes: "chiemo is attested as food. Review the rest. ayie and Kisumu stay.",
  },
  home_ask_button: { en: "Ask", dholuo: "Penj", draft: false, page: "Home", notes: "Review penj." },
  prompt_ayie: {
    en: "Catering for an ayie in Kisumu for 200",
    dholuo: "chiemo mar ayie Kisumu ne ji 200",
    draft: false,
    page: "Home",
    notes: "Visible label only. The search still sends the English sentence.",
  },
  prompt_tilapia: {
    en: "Fresh tilapia in Nairobi",
    dholuo: "Rech Ngege",
    draft: false,
    page: "Home",
    notes: "Review rech = fish. Search query stays English.",
  },
  prompt_dj: { en: "DJ for an ayie", dholuo: "DJ mar ayie", draft: false, page: "Home", notes: "DJ and ayie stay. Search query stays English." },
  prompt_fundi: {
    en: "Find a fundi in Kisumu",
    dholuo: "many fundi Kisumu",
    draft: false,
    page: "Home",
    notes: "fundi and Kisumu stay. Search query stays English.",
  },
  prompt_dowry: {
    en: "Dowry ceremony catering",
    dholuo: "chiemo mar ayie",
    draft: false,
    page: "Home",
    notes: "ayie is the dowry ceremony. Search query stays English.",
  },
  chip_all: { en: "All", dholuo: "Te", draft: false, page: "Home", notes: "Review. te = all." },
  chip_food: { en: "Food", dholuo: "Chiemo", draft: false, page: "Home", notes: "chiemo is attested as food." },
  chip_events: { en: "Events", dholuo: "Nyasi", draft: false, page: "Home", notes: "Review." },
  chip_housing: { en: "Housing", dholuo: "Ute", draft: false, page: "Home", notes: "Review. ot = house." },
  chip_fundis: { en: "Fundis", dholuo: "Fundi", draft: false, page: "Home", notes: "Keep fundi." },
  chip_beauty: { en: "Beauty", dholuo: "Ber", draft: false, page: "Home", notes: "Review. ber = beauty or goodness." },
  chip_transport: { en: "Transport", dholuo: "Wuoth", draft: false, page: "Home", notes: "Review. wuoth = a journey." },
  chip_shops: { en: "Shops", dholuo: "Duka", draft: false, page: "Home", notes: "Review. duka is the usual shop word." },
  home_fresh: { en: "Fresh", dholuo: "Manyien", draft: false, page: "Home", notes: "Review. manyien = new." },
  home_see_all: { en: "See all", dholuo: "Nee duto", draft: false, page: "Home", notes: "Review." },
  home_nothing_fresh: { en: "Nothing fresh yet", dholuo: "Pod onge gik manyien", draft: false, page: "Home", notes: "Review." },
  home_nothing_fresh_body: {
    en: "Shops and classifieds show here as people publish them.",
    dholuo: "Duka kod gik ma iuse biro ka ji oketo.",
    draft: false,
    page: "Home",
    notes: "Review.",
  },
  home_list_free: { en: "List your business free", dholuo: "Ket duka mari, nono", draft: false, page: "Home", notes: "Review. nono = for free." },
  home_shops: { en: "Shops", dholuo: "Duka", draft: false, page: "Home", notes: "Review." },
  home_all_shops: { en: "All shops", dholuo: "Dukni duto", draft: false, page: "Home", notes: "Review." },
  home_no_shops: { en: "No shops yet", dholuo: "Onge Duka", draft: false, page: "Home", notes: "Review." },
  home_no_shops_body: {
    en: "Shops show here after a seller adds an offering and publishes.",
    dholuo: "Duka biro ka Wuon Duka oketo gima ouso.",
    draft: false,
    page: "Home",
    notes: "Review.",
  },
  home_occasions: { en: "Occasions", dholuo: "Nyasi", draft: false, page: "Home", notes: "Review." },
  home_all_occasions: { en: "All occasions", dholuo: "Nyasi duto", draft: false, page: "Home", notes: "Review." },
  home_occasions_note: {
    en: "Homecomings, weddings and ayie, Christmas at home, and a house being built for the family.",
    dholuo: "Duogo dala, keny kod ayie, Christmas dala, kod gero ot.",
    draft: false,
    page: "Home",
    notes: "Review. ayie stays. No funeral wording.",
  },
  home_family: { en: "Buying for family back home?", dholuo: "Ng'iewo ne joodu dala?", draft: false, page: "Home", notes: "Review." },
  home_family_body: {
    en: "Some shops take a WhatsApp order from the Diaspora for family in Kenya. Payment stays between you and the seller.",
    dholuo: "Duka moko kawo oda WhatsApp koa Diaspora ne joodu Kenya. Chudo bedo e kindi kod wuon Duka.",
    draft: false,
    page: "Home",
    notes: "Review. Payment stays with the seller. Do not say Rangach holds the money.",
  },
  home_see_shops: { en: "See those shops", dholuo: "Ne duka go", draft: false, page: "Home", notes: "Review." },
  home_list_body: {
    en: "Open a shop, add what you sell, and buyers message you on WhatsApp. Kenya, East Africa and the Diaspora.",
    dholuo: "Yaw duka, ket gima iuso, kendo jang'iew gocho e WhatsApp. Kenya, East Africa kod Diaspora.",
    draft: false,
    page: "Home",
    notes: "Review. English keeps the audience line.",
  },
  home_draft_help: {
    en: "Rangach can draft the listing words for you.",
    dholuo: "Rangach nyalo ndiko ni weche mag listing",
    draft: false,
    page: "Home",
    notes: "Review. listing kept.",
  },

  search_button: { en: "Search", dholuo: "Manyo", draft: false, page: "Browse", notes: "Review." },
  filters: { en: "Filters", dholuo: "Yiero", draft: false, page: "Browse", notes: "Review. yier = choose." },
  close: { en: "Close", dholuo: "Lor", draft: false, page: "Browse", notes: "Review. lor = close or shut." },
  close_filters: { en: "Close filters", dholuo: "Lor Yiero", draft: false, page: "Browse", notes: "Review." },
  place_label: { en: "Homeland or Diaspora", dholuo: "Dala kata Diaspora", draft: false, page: "Browse", notes: "Review piny = the land." },
  any: { en: "Any", dholuo: "Mor Amora", draft: false, page: "Browse", notes: "Review." },
  homeland: { en: "Homeland", dholuo: "Dala", draft: false, page: "Browse", notes: "Review." },
  diaspora: { en: "Diaspora", dholuo: "Diaspora", draft: false, page: "Browse", notes: "Keep the loanword." },
  town: { en: "Town", dholuo: "Boma", draft: false, page: "Browse", notes: "Review. boma = town." },
  any_town: { en: "Any town", dholuo: "Boma mor Amora", draft: false, page: "Browse", notes: "Review." },
  category: { en: "Category", dholuo: "Kit", draft: false, page: "Browse", notes: "Review. kit = kind." },
  type: { en: "Type", dholuo: "Kido", draft: false, page: "Browse", notes: "Review." },
  shop_badge: { en: "Shop badge", dholuo: "Ranyisi mar duka", draft: false, page: "Browse", notes: "Review." },
  badge_any: { en: "Any shop badge", dholuo: "Ranyisi mor amora", draft: false, page: "Browse", notes: "Review." },
  badge_phone: { en: "Phone verified", dholuo: "Simu ong'ere", draft: false, page: "Browse", notes: "Review." },
  badge_location: { en: "Location verified", dholuo: "Kama nitie ong'ere", draft: false, page: "Browse", notes: "Review." },
  badge_business: { en: "Business verified", dholuo: "Ohala ong'ere", draft: false, page: "Browse", notes: "Review." },
  all_classifieds: { en: "All classifieds", dholuo: "Gik ma ipso te", draft: false, page: "Browse", notes: "Review." },
  type_business: { en: "Business", dholuo: "Ohala", draft: false, page: "Browse", notes: "Review." },
  type_for_sale: { en: "For sale", dholuo: "Sale", draft: false, page: "Browse", notes: "Review." },
  type_wanted: { en: "Wanted", dholuo: "Midwaro", draft: false, page: "Browse", notes: "Review." },
  type_housing: { en: "Housing", dholuo: "Ot", draft: false, page: "Browse", notes: "Review." },
  type_services: { en: "Services", dholuo: "Tich", draft: false, page: "Browse", notes: "Review. tich = work." },
  checked_only: { en: "Checked only", dholuo: "Ong'ere kende", draft: false, page: "Browse", notes: "Review." },
  checked_shops: { en: "Checked shops", dholuo: "Duka mong'ere", draft: false, page: "Browse", notes: "Review." },
  diaspora_orders: { en: DIASPORA_ORDERS_LABEL, dholuo: "Kawo oda Diaspora", draft: false, page: "Browse", notes: "Review." },
  apply_filters: { en: "Apply filters", dholuo: "Tim yiero", draft: false, page: "Browse", notes: "Review." },
  clear: { en: "Clear", dholuo: "Golo", draft: false, page: "Browse", notes: "Review. golo = remove." },
  understood: { en: "Rangach understood", dholuo: "Rangach ong'eyo", draft: false, page: "Ask Rangach", notes: "Review. ong'eyo = has understood." },
  understood_fallback: {
    en: "Smart search did not answer. Showing the plain reading.",
    dholuo: "Manyo mar AI ok oyudo dwoko",
    draft: false,
    page: "Ask Rangach",
    notes: "Review.",
  },
  no_filters: { en: "No filters detected.", dholuo: "Ok oyudo yiero", draft: false, page: "Ask Rangach", notes: "Review." },
  remove: { en: "Remove", dholuo: "Gol", draft: false, page: "Ask Rangach", notes: "Review. Screen-reader label." },
  dropped_words: {
    en: "Some of those words were not in any listing, so Rangach left them out and kept the rest of the search.",
    dholuo: "Weche moko ne onge e listing, omiyo Rangach oweyogi kendo ogolo moko.",
    draft: false,
    page: "Ask Rangach",
    notes: "Review.",
  },
  pill_checked: { en: "Checked", dholuo: "Ong'ere", draft: false, page: "Browse", notes: "Review." },
  browse_title: { en: "Browse", dholuo: "Manyo", draft: false, page: "Browse", notes: "Review." },
  search_shops_label: { en: "Search shops", dholuo: "Many duka", draft: false, page: "Shops", notes: "Review." },
  nothing_matches: { en: "Nothing matches", dholuo: "Onge dwoko", draft: false, page: "Browse", notes: "Review." },
  nothing_matches_body: {
    en: "Try clearing a filter or searching with different words.",
    dholuo: "Tem golo yiero kata many gi weche mamoko.",
    draft: false,
    page: "Browse",
    notes: "Review.",
  },
  clear_filters: { en: "Clear filters", dholuo: "Clear filter", draft: false, page: "Browse", notes: "Review." },
  matches_for: { en: "Matches for “{q}”.", dholuo: "Gik ma chal “{q}”.", draft: false, page: "Browse", notes: "Review. {q} is the typed search." },
  showing_shops: { en: "Showing shops for “{q}”.", dholuo: "Duka mag “{q}”.", draft: false, page: "Shops", notes: "Review." },
  no_shops_match: { en: "No shops match", dholuo: "Onge Duka", draft: false, page: "Shops", notes: "Review." },
  no_shops_match_body: {
    en: "Try another word, or clear a filter. Draft shops stay off this page.",
    dholuo: "Tem wach machielo, kata gol yiero. Duka ma pok oyaw ok yudre ka.",
    draft: false,
    page: "Shops",
    notes: "Review.",
  },

  whatsapp_seller: { en: "WhatsApp the seller", dholuo: "WhatsApp wuon ohala", draft: false, page: "Listing", notes: "Review. Brand name stays." },
  share_whatsapp: { en: "Share on WhatsApp", dholuo: "Oor e WhatsApp", draft: false, page: "Listing", notes: "oor is attested as send." },
  call: { en: "Call", dholuo: "Gocho", draft: false, page: "Listing", notes: "Review. gocho = call." },
  visit_shop: { en: "Visit storefront", dholuo: "Dhi e duka", draft: false, page: "Listing", notes: "Review." },
  edit: { en: "Edit", dholuo: "Lok", draft: false, page: "Listing", notes: "Review. lok = change." },
  manage_shop: { en: "Manage storefront", dholuo: "Manage storefront", draft: false, page: "Listing", notes: "Review." },
  feature_listing: { en: "Feature this listing", dholuo: "Ket listing ni malo", draft: false, page: "Listing", notes: "Review." },
  contact: { en: "Contact", dholuo: "Tudruok", draft: false, page: "Listing", notes: "Review." },
  reviews: { en: "Reviews", dholuo: "Paro", draft: false, page: "Listing", notes: "Review. paro = a thought or opinion." },
  no_reviews: { en: "No reviews yet", dholuo: "Pod onge paro", draft: false, page: "Listing", notes: "Review." },
  no_reviews_dot: { en: "No reviews yet.", dholuo: "Pod onge paro", draft: false, page: "Listing", notes: "Review." },
  sign_in_review: { en: "Sign in to review", dholuo: "Donj mondo iwach pachi", draft: false, page: "Listing", notes: "Review." },
  report_listing: { en: "Report this listing", dholuo: "Ngol listing ni", draft: false, page: "Listing", notes: "Review. ngol = tell or report." },
  block_person: { en: "Block this person", dholuo: "Geng ng'atni", draft: false, page: "Listing", notes: "Review." },
  view_business: { en: "View business profile", dholuo: "Ne ohala", draft: false, page: "Listing", notes: "Review." },
  view_person: { en: "View person profile", dholuo: "Ne ng'atni", draft: false, page: "Listing", notes: "Review." },
  buying_for_family: { en: "Buying for family back home?", dholuo: "Ng'iewo ne joodu dala?", draft: false, page: "Listing", notes: "Review." },
  send_family_order: { en: "Send a family order", dholuo: "Oor oda ne joot", draft: false, page: "Shop", notes: "oor is attested as send. Review oda." },

  share: { en: "Share", dholuo: "Oor", draft: false, page: "Shop", notes: "oor is attested as send." },
  offerings: { en: "Offerings", dholuo: "Gik ma iuso", draft: false, page: "Shop", notes: "Review." },
  about: { en: "About", dholuo: "Kuom", draft: false, page: "Shop", notes: "Review. kuom = about." },
  ask_whatsapp: { en: "Ask on WhatsApp", dholuo: "Penj e WhatsApp", draft: false, page: "Shop", notes: "Review." },
  no_offerings: { en: "No offerings yet", dholuo: "Onge Duka", draft: false, page: "Shop", notes: "Review." },
  no_offerings_body: {
    en: "This shop has not listed products or services.",
    dholuo: "Duka ni pok oketo gik ma iuso.",
    draft: false,
    page: "Shop",
    notes: "Review.",
  },
  shop_no_about: {
    en: "This shop has not added a description yet.",
    dholuo: "Duka ni pok ondiko wach kuome.",
    draft: false,
    page: "Shop",
    notes: "Review. The seller's own words are not translated.",
  },
  family_orders_note: {
    en: "Takes orders for family back home.",
    dholuo: "Kawo oda ne joma ni dala.",
    draft: false,
    page: "Shop",
    notes: "Review.",
  },
  directory_listing: { en: "Directory listing", dholuo: "Listing e buk", draft: false, page: "Shop", notes: "Review. The listing title stays as written." },
  view_profile: { en: "View profile", dholuo: "Ne profile", draft: false, page: "Shop", notes: "Review. profile kept." },
  no_reviews_shop: { en: "No reviews yet", dholuo: "Pod onge paro", draft: false, page: "Shop", notes: "Review." },
  no_reviews_shop_body: {
    en: "When a buyer leaves a review on a listing, it shows up here.",
    dholuo: "Ka jang'iew oweyo paro e listing, obiro ka.",
    draft: false,
    page: "Shop",
    notes: "Review. Review text itself stays as written.",
  },
  report_shop: { en: "Report this shop", dholuo: "Ngol duka ni", draft: false, page: "Shop", notes: "Review." },
  sign_in_report: { en: "Sign in to report this shop", dholuo: "Donj mondo ingol duka ni", draft: false, page: "Shop", notes: "Review." },
  whatsapp_name: { en: "WhatsApp {name}", dholuo: "WhatsApp {name}", draft: false, page: "Shop", notes: "{name} is the shop name, unchanged." },
  checked_by: { en: "Checked by Rangach", dholuo: "Rangach ong’eye", draft: false, page: "Shop", notes: "Review." },
  close_checks: { en: "Close checks", dholuo: "Lor ranyisi", draft: false, page: "Shop", notes: "Review." },
  shop_sections: { en: "Shop sections", dholuo: "Kuonde mag duka", draft: false, page: "Shop", notes: "Review. Screen-reader label." },
  shop_video: { en: "Shop video", dholuo: "Video mar duka", draft: false, page: "Shop", notes: "Review." },

  tour_dialog: { en: "Guided tour", dholuo: "Tour", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_ask_title: { en: "Ask Rangach", dholuo: "Penj Rangach", draft: false, page: "Tour", notes: "Kevin signed off. penj." },
  tour_ask_body: {
    en: "Type a sentence, like fresh tilapia or a fundi in Kisumu.",
    dholuo: "Ndik wach, kaka rech ngege kata fundi Kisumu.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off. Examples are tilapia and a fundi in Kisumu.",
  },
  tour_nav_title: { en: "Along the bottom", dholuo: "Piny ka", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_nav_body: {
    en: "{home}, {explore}, {ask}, {occasions}, and {sell}.",
    dholuo: "{home}, {explore}, {ask}, {occasions}, kod {sell}.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off. The words in braces are the live bottom-nav labels.",
  },
  tour_filters_title: { en: "Filters and town", dholuo: "Yiero kod boma", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_filters_body: {
    en: "On Browse, open Filters and choose a town such as Kisumu.",
    dholuo: "E manyo, yaw Yiero kendo yier boma kaka Kisumu.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off.",
  },
  tour_whatsapp_title: { en: "WhatsApp the seller", dholuo: "WhatsApp wuon ohala", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_whatsapp_body: {
    en: "Message the seller on WhatsApp. Ask about an ayie, or a fundi in Kisumu.",
    dholuo: "Goch ne wuon ohala e WhatsApp. Penj wach ayie kata fundi Kisumu.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off. No payment-holding wording.",
  },
  tour_sell_title: { en: "Sell or open a shop", dholuo: "Uso kata yaw duka", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_sell_body: {
    en: "List your business free, then open a shop for what you sell.",
    dholuo: "Ket ohala mari nono, eka yaw duka.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off.",
  },
  tour_next: { en: "Next", dholuo: "Machielo", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_skip: { en: "Skip", dholuo: "Skip", draft: false, page: "Tour", notes: "Kevin signed off. Brand-style word stays." },
  tour_done: { en: "Done", dholuo: "Done", draft: false, page: "Tour", notes: "Kevin signed off. Word stays." },
  tour_replay: { en: "Show me around", dholuo: "Miya Tour", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_step: { en: "Step {n} of {total}", dholuo: "Okang' {n} kuom {total}", draft: false, page: "Tour", notes: "Kevin signed off. Screen reader." },
  tour_seller_offer_title: { en: "What you sell", dholuo: "Gima iuso", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_seller_offer_body: {
    en: "Name it clearly. Catering for an ayie is enough to start.",
    dholuo: "Ket nying maber. Kaka Chiemo mar ayie oromo.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off.",
  },
  tour_seller_town_title: { en: "Your town", dholuo: "Boma mari", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_seller_town_body: {
    en: "Pick a town, such as Kisumu, so nearby people can find you.",
    dholuo: "Yier boma, kaka Kisumu.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off.",
  },
  tour_seller_publish_title: { en: "Publish", dholuo: "Yaw", draft: false, page: "Tour", notes: "Kevin signed off." },
  tour_seller_publish_body: {
    en: "Publish when it looks right. Buyers message you on WhatsApp.",
    dholuo: "Yaw ka gimoro amora ni maber. Joma ng'iewo gocho ni e WhatsApp.",
    draft: false,
    page: "Tour",
    notes: "Kevin signed off.",
  },
} as const satisfies Record<string, UiString>;

export type StringKey = keyof typeof UI_STRINGS;

export function uiText(lang: Lang, key: StringKey): string {
  const row = UI_STRINGS[key];
  return lang === "dholuo" ? row.dholuo : row.en;
}

export function uiFill(lang: Lang, key: StringKey, vars: Record<string, string | number>): string {
  return uiText(lang, key).replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

function cell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Reviewed and held lines for the string list. */
export function dholuoStringsMarkdown(): string {
  const lines = [
    "# Dholuo UI strings",
    "",
    "Kevin signed off the chrome and the guided tour (`draft: false`). A held status would mean a line is still a draft.",
    "Seller titles, descriptions, bios, offerings, and reviews are not in this list.",
    "",
    "| Key | Page | English | Dholuo | Status | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const [key, row] of Object.entries(UI_STRINGS)) {
    const status = row.draft ? "held" : "reviewed";
    lines.push(`| ${key} | ${cell(row.page)} | ${cell(row.en)} | ${cell(row.dholuo)} | ${status} | ${cell(row.notes)} |`);
  }
  return `${lines.join("\n")}\n`;
}

/** Tour copy only. Kevin signed off every line. */
export function tourStringsMarkdown(): string {
  const lines = [
    "# Guided tour Dholuo",
    "",
    "Tour copy only. Kevin signed off every Dholuo line (`draft: false`).",
    "",
    "| Key | English | Dholuo |",
    "| --- | --- | --- |",
  ];
  for (const [key, row] of Object.entries(UI_STRINGS)) {
    if (!key.startsWith("tour_")) continue;
    lines.push(`| ${key} | ${cell(row.en)} | ${cell(row.dholuo)} |`);
  }
  return `${lines.join("\n")}\n`;
}
