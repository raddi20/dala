import { DIASPORA_ORDERS_LABEL } from "@/lib/diaspora";
import { HOME_ASK_PLACEHOLDER } from "@/lib/home-prompts";
import type { Lang } from "@/lib/i18n/lang";

/**
 * Chrome copy only. Listing titles, shop bios, offerings, and reviews stay as the seller wrote them.
 * Every Dholuo line is a draft (`draft: true`) for a native speaker.
 */
export type UiString = {
  en: string;
  dholuo: string;
  draft: true;
  page: string;
  notes: string;
};

export const UI_STRINGS = {
  nav_home: { en: "Home", dholuo: "Dala", draft: true, page: "Bottom nav", notes: "dala is attested as home." },
  nav_explore: { en: "Explore", dholuo: "Manyo", draft: true, page: "Bottom nav", notes: "Review. manyo = look for." },
  nav_ask: { en: "Ask", dholuo: "Penj", draft: true, page: "Bottom nav", notes: "Review. penj = ask." },
  nav_occasions: { en: "Occasions", dholuo: "Kinde", draft: true, page: "Bottom nav", notes: "Review. kinde = a time." },
  nav_sell: { en: "Sell", dholuo: "Uso", draft: true, page: "Bottom nav", notes: "Review. uso = sell." },

  lang_group: { en: "Language", dholuo: "Dhok", draft: true, page: "Language switch", notes: "Review. dhok = language or mouth." },
  lang_en: { en: "EN", dholuo: "EN", draft: true, page: "Language switch", notes: "Keep the short switch label." },
  lang_dholuo: { en: "Dholuo", dholuo: "Dholuo", draft: true, page: "Language switch", notes: "Name of the language." },

  home_ask_title: { en: "Ask Rangach", dholuo: "Penj Rangach", draft: true, page: "Home", notes: "Review penj." },
  home_ask_sub: {
    en: "Shops and classifieds in Kenya, East Africa and the Diaspora. Chat stays on WhatsApp.",
    dholuo: "Duka kod gik ma use e Kenya, East Africa kod Diaspora. Wach bedo e WhatsApp.",
    draft: true,
    page: "Home",
    notes: "Review. English keeps the audience line.",
  },
  home_search_label: { en: "Search in a sentence", dholuo: "Many gi wach achiel", draft: true, page: "Home", notes: "Review." },
  ask_placeholder: {
    en: HOME_ASK_PLACEHOLDER,
    dholuo: "chiemo mar ayie Kisumu ni ji 200",
    draft: true,
    page: "Ask Rangach",
    notes: "chiemo is attested as food. Review the rest. ayie and Kisumu stay.",
  },
  home_ask_button: { en: "Ask", dholuo: "Penj", draft: true, page: "Home", notes: "Review penj." },
  prompt_ayie: {
    en: "Catering for an ayie in Kisumu for 200",
    dholuo: "chiemo mar ayie Kisumu ni ji 200",
    draft: true,
    page: "Home",
    notes: "Visible label only. The search still sends the English sentence.",
  },
  prompt_tilapia: {
    en: "Fresh tilapia in Nairobi",
    dholuo: "rech tilapia manyien Nairobi",
    draft: true,
    page: "Home",
    notes: "Review rech = fish. Search query stays English.",
  },
  prompt_dj: { en: "DJ for an ayie", dholuo: "DJ mar ayie", draft: true, page: "Home", notes: "DJ and ayie stay. Search query stays English." },
  prompt_fundi: {
    en: "Find a fundi in Kisumu",
    dholuo: "many fundi Kisumu",
    draft: true,
    page: "Home",
    notes: "fundi and Kisumu stay. Search query stays English.",
  },
  prompt_dowry: {
    en: "Dowry ceremony catering",
    dholuo: "chiemo mar ayie",
    draft: true,
    page: "Home",
    notes: "ayie is the dowry ceremony. Search query stays English.",
  },
  chip_all: { en: "All", dholuo: "Te", draft: true, page: "Home", notes: "Review. te = all." },
  chip_food: { en: "Food", dholuo: "Chiemo", draft: true, page: "Home", notes: "chiemo is attested as food." },
  chip_events: { en: "Events", dholuo: "Kinde", draft: true, page: "Home", notes: "Review." },
  chip_housing: { en: "Housing", dholuo: "Ot", draft: true, page: "Home", notes: "Review. ot = house." },
  chip_fundis: { en: "Fundis", dholuo: "Fundi", draft: true, page: "Home", notes: "Keep fundi." },
  chip_beauty: { en: "Beauty", dholuo: "Ber", draft: true, page: "Home", notes: "Review. ber = beauty or goodness." },
  chip_transport: { en: "Transport", dholuo: "Wuoth", draft: true, page: "Home", notes: "Review. wuoth = a journey." },
  chip_shops: { en: "Shops", dholuo: "Duka", draft: true, page: "Home", notes: "Review. duka is the usual shop word." },
  home_fresh: { en: "Fresh", dholuo: "Manyien", draft: true, page: "Home", notes: "Review. manyien = new." },
  home_see_all: { en: "See all", dholuo: "Ne te", draft: true, page: "Home", notes: "Review." },
  home_nothing_fresh: { en: "Nothing fresh yet", dholuo: "Pok nitie gik manyien", draft: true, page: "Home", notes: "Review." },
  home_nothing_fresh_body: {
    en: "Shops and classifieds show here as people publish them.",
    dholuo: "Duka kod gik ma use biro ka ji oketo.",
    draft: true,
    page: "Home",
    notes: "Review.",
  },
  home_list_free: { en: "List your business free", dholuo: "Ket duka mari, nono", draft: true, page: "Home", notes: "Review. nono = for free." },
  home_shops: { en: "Shops", dholuo: "Duka", draft: true, page: "Home", notes: "Review." },
  home_all_shops: { en: "All shops", dholuo: "Duka te", draft: true, page: "Home", notes: "Review." },
  home_no_shops: { en: "No shops yet", dholuo: "Pok nitie duka", draft: true, page: "Home", notes: "Review." },
  home_no_shops_body: {
    en: "Shops show here after a seller adds an offering and publishes.",
    dholuo: "Duka biro ka ng'at uso oketo gima uso.",
    draft: true,
    page: "Home",
    notes: "Review.",
  },
  home_occasions: { en: "Occasions", dholuo: "Kinde", draft: true, page: "Home", notes: "Review." },
  home_all_occasions: { en: "All occasions", dholuo: "Kinde te", draft: true, page: "Home", notes: "Review." },
  home_occasions_note: {
    en: "Homecomings, weddings and ayie, Christmas at home, and a house being built for the family.",
    dholuo: "Duogo dala, keny kod ayie, Christmas dala, kod ot ma ger ne joot.",
    draft: true,
    page: "Home",
    notes: "Review. ayie stays. No funeral wording.",
  },
  home_family: { en: "Buying for family back home?", dholuo: "Ng'iewo ne joodu dala?", draft: true, page: "Home", notes: "Review." },
  home_family_body: {
    en: "Some shops take a WhatsApp order from the Diaspora for family in Kenya. Payment stays between you and the seller.",
    dholuo: "Duka moko kawo oda WhatsApp koa Diaspora ne joodu Kenya. Chudo bedo e kindi kod ng'at uso.",
    draft: true,
    page: "Home",
    notes: "Review. Payment stays with the seller. Do not say Rangach holds the money.",
  },
  home_see_shops: { en: "See those shops", dholuo: "Ne duka go", draft: true, page: "Home", notes: "Review." },
  home_list_body: {
    en: "Open a shop, add what you sell, and buyers message you on WhatsApp. Kenya, East Africa and the Diaspora.",
    dholuo: "Yaw duka, ket gima iuso, kendo jang'iew gochi e WhatsApp. Kenya, East Africa kod Diaspora.",
    draft: true,
    page: "Home",
    notes: "Review. English keeps the audience line.",
  },
  home_draft_help: {
    en: "Rangach can draft the listing words for you.",
    dholuo: "Rangach nyalo ndiko weche mag listing ni.",
    draft: true,
    page: "Home",
    notes: "Review. listing kept.",
  },

  search_button: { en: "Search", dholuo: "Manyo", draft: true, page: "Browse", notes: "Review." },
  filters: { en: "Filters", dholuo: "Yier", draft: true, page: "Browse", notes: "Review. yier = choose." },
  close: { en: "Close", dholuo: "Lor", draft: true, page: "Browse", notes: "Review. lor = close or shut." },
  close_filters: { en: "Close filters", dholuo: "Lor yier", draft: true, page: "Browse", notes: "Review." },
  place_label: { en: "Homeland or Diaspora", dholuo: "Piny kata Diaspora", draft: true, page: "Browse", notes: "Review piny = the land." },
  any: { en: "Any", dholuo: "Amora", draft: true, page: "Browse", notes: "Review." },
  homeland: { en: "Homeland", dholuo: "Piny", draft: true, page: "Browse", notes: "Review." },
  diaspora: { en: "Diaspora", dholuo: "Diaspora", draft: true, page: "Browse", notes: "Keep the loanword." },
  town: { en: "Town", dholuo: "Boma", draft: true, page: "Browse", notes: "Review. boma = town." },
  any_town: { en: "Any town", dholuo: "Boma amora", draft: true, page: "Browse", notes: "Review." },
  category: { en: "Category", dholuo: "Kit", draft: true, page: "Browse", notes: "Review. kit = kind." },
  type: { en: "Type", dholuo: "Kido", draft: true, page: "Browse", notes: "Review." },
  shop_badge: { en: "Shop badge", dholuo: "Ranyisi mar duka", draft: true, page: "Browse", notes: "Review." },
  badge_any: { en: "Any shop badge", dholuo: "Ranyisi amora", draft: true, page: "Browse", notes: "Review." },
  badge_phone: { en: "Phone verified", dholuo: "Simu ong'ere", draft: true, page: "Browse", notes: "Review." },
  badge_location: { en: "Location verified", dholuo: "Kama nitie ong'ere", draft: true, page: "Browse", notes: "Review." },
  badge_business: { en: "Business verified", dholuo: "Ohala ong'ere", draft: true, page: "Browse", notes: "Review." },
  all_classifieds: { en: "All classifieds", dholuo: "Gik ma use te", draft: true, page: "Browse", notes: "Review." },
  type_business: { en: "Business", dholuo: "Ohala", draft: true, page: "Browse", notes: "Review." },
  type_for_sale: { en: "For sale", dholuo: "Ni uso", draft: true, page: "Browse", notes: "Review." },
  type_wanted: { en: "Wanted", dholuo: "Madwaro", draft: true, page: "Browse", notes: "Review." },
  type_housing: { en: "Housing", dholuo: "Ot", draft: true, page: "Browse", notes: "Review." },
  type_services: { en: "Services", dholuo: "Tich", draft: true, page: "Browse", notes: "Review. tich = work." },
  checked_only: { en: "Checked only", dholuo: "Ong'ere kende", draft: true, page: "Browse", notes: "Review." },
  checked_shops: { en: "Checked shops", dholuo: "Duka mong'ere", draft: true, page: "Browse", notes: "Review." },
  diaspora_orders: { en: DIASPORA_ORDERS_LABEL, dholuo: "Kawo oda Diaspora", draft: true, page: "Browse", notes: "Review." },
  apply_filters: { en: "Apply filters", dholuo: "Tim yier", draft: true, page: "Browse", notes: "Review." },
  clear: { en: "Clear", dholuo: "Golo", draft: true, page: "Browse", notes: "Review. golo = remove." },
  understood: { en: "Rangach understood", dholuo: "Rangach ong'eyo", draft: true, page: "Ask Rangach", notes: "Review. ong'eyo = has understood." },
  understood_fallback: {
    en: "Smart search did not answer. Showing the plain reading.",
    dholuo: "Many ma rieko ne ok odwoko. Wanenyu somo mapoth.",
    draft: true,
    page: "Ask Rangach",
    notes: "Review.",
  },
  no_filters: { en: "No filters detected.", dholuo: "Ok oyud yier.", draft: true, page: "Ask Rangach", notes: "Review." },
  remove: { en: "Remove", dholuo: "Gol", draft: true, page: "Ask Rangach", notes: "Review. Screen-reader label." },
  dropped_words: {
    en: "Some of those words were not in any listing, so Rangach left them out and kept the rest of the search.",
    dholuo: "Weche moko ne onge e listing, omiyo Rangach oweyogi kendo ogolo moko.",
    draft: true,
    page: "Ask Rangach",
    notes: "Review.",
  },
  pill_checked: { en: "Checked", dholuo: "Ong'ere", draft: true, page: "Browse", notes: "Review." },
  browse_title: { en: "Browse", dholuo: "Manyo", draft: true, page: "Browse", notes: "Review." },
  search_shops_label: { en: "Search shops", dholuo: "Many duka", draft: true, page: "Shops", notes: "Review." },
  nothing_matches: { en: "Nothing matches", dholuo: "Onge ma owinjo", draft: true, page: "Browse", notes: "Review." },
  nothing_matches_body: {
    en: "Try clearing a filter or searching with different words.",
    dholuo: "Tem golo yier kata many gi weche mamoko.",
    draft: true,
    page: "Browse",
    notes: "Review.",
  },
  clear_filters: { en: "Clear filters", dholuo: "Golo yier", draft: true, page: "Browse", notes: "Review." },
  matches_for: { en: "Matches for “{q}”.", dholuo: "Gik ma owinjo “{q}”.", draft: true, page: "Browse", notes: "Review. {q} is the typed search." },
  showing_shops: { en: "Showing shops for “{q}”.", dholuo: "Duka mag “{q}”.", draft: true, page: "Shops", notes: "Review." },
  no_shops_match: { en: "No shops match", dholuo: "Onge duka ma owinjo", draft: true, page: "Shops", notes: "Review." },
  no_shops_match_body: {
    en: "Try another word, or clear a filter. Draft shops stay off this page.",
    dholuo: "Tem wach machielo, kata gol yier. Duka ma pok oyau ok biro ka.",
    draft: true,
    page: "Shops",
    notes: "Review.",
  },

  whatsapp_seller: { en: "WhatsApp the seller", dholuo: "WhatsApp ng'at uso", draft: true, page: "Listing", notes: "Review. Brand name stays." },
  share_whatsapp: { en: "Share on WhatsApp", dholuo: "Oor e WhatsApp", draft: true, page: "Listing", notes: "oor is attested as send." },
  call: { en: "Call", dholuo: "Gocho", draft: true, page: "Listing", notes: "Review. gocho = call." },
  visit_shop: { en: "Visit storefront", dholuo: "Dhi e duka", draft: true, page: "Listing", notes: "Review." },
  edit: { en: "Edit", dholuo: "Lok", draft: true, page: "Listing", notes: "Review. lok = change." },
  manage_shop: { en: "Manage storefront", dholuo: "Rit duka", draft: true, page: "Listing", notes: "Review." },
  feature_listing: { en: "Feature this listing", dholuo: "Ket listing ni malo", draft: true, page: "Listing", notes: "Review." },
  contact: { en: "Contact", dholuo: "Tudruok", draft: true, page: "Listing", notes: "Review." },
  reviews: { en: "Reviews", dholuo: "Paro", draft: true, page: "Listing", notes: "Review. paro = a thought or opinion." },
  no_reviews: { en: "No reviews yet", dholuo: "Pok nitie paro", draft: true, page: "Listing", notes: "Review." },
  no_reviews_dot: { en: "No reviews yet.", dholuo: "Pok nitie paro.", draft: true, page: "Listing", notes: "Review." },
  sign_in_review: { en: "Sign in to review", dholuo: "Donj mondo iwach paro", draft: true, page: "Listing", notes: "Review." },
  report_listing: { en: "Report this listing", dholuo: "Ngol listing ni", draft: true, page: "Listing", notes: "Review. ngol = tell or report." },
  block_person: { en: "Block this person", dholuo: "Geng ng'atni", draft: true, page: "Listing", notes: "Review." },
  view_business: { en: "View business profile", dholuo: "Ne ohala", draft: true, page: "Listing", notes: "Review." },
  view_person: { en: "View person profile", dholuo: "Ne ng'atni", draft: true, page: "Listing", notes: "Review." },
  buying_for_family: { en: "Buying for family back home?", dholuo: "Ng'iewo ne joodu dala?", draft: true, page: "Listing", notes: "Review." },
  send_family_order: { en: "Send a family order", dholuo: "Oor oda ne joot", draft: true, page: "Shop", notes: "oor is attested as send. Review oda." },

  share: { en: "Share", dholuo: "Oor", draft: true, page: "Shop", notes: "oor is attested as send." },
  offerings: { en: "Offerings", dholuo: "Gik ma use", draft: true, page: "Shop", notes: "Review." },
  about: { en: "About", dholuo: "Kuom", draft: true, page: "Shop", notes: "Review. kuom = about." },
  ask_whatsapp: { en: "Ask on WhatsApp", dholuo: "Penj e WhatsApp", draft: true, page: "Shop", notes: "Review." },
  no_offerings: { en: "No offerings yet", dholuo: "Pok nitie gik ma use", draft: true, page: "Shop", notes: "Review." },
  no_offerings_body: {
    en: "This shop has not listed products or services.",
    dholuo: "Duka ni pok oketo gik ma uso.",
    draft: true,
    page: "Shop",
    notes: "Review.",
  },
  shop_no_about: {
    en: "This shop has not added a description yet.",
    dholuo: "Duka ni pok ondiko wach kuome.",
    draft: true,
    page: "Shop",
    notes: "Review. The seller's own words are not translated.",
  },
  family_orders_note: {
    en: "Takes orders for family back home.",
    dholuo: "Kawo oda ne joot dala.",
    draft: true,
    page: "Shop",
    notes: "Review.",
  },
  directory_listing: { en: "Directory listing", dholuo: "Listing e buk", draft: true, page: "Shop", notes: "Review. The listing title stays as written." },
  view_profile: { en: "View profile", dholuo: "Ne profile", draft: true, page: "Shop", notes: "Review. profile kept." },
  no_reviews_shop: { en: "No reviews yet", dholuo: "Pok nitie paro", draft: true, page: "Shop", notes: "Review." },
  no_reviews_shop_body: {
    en: "When a buyer leaves a review on a listing, it shows up here.",
    dholuo: "Ka jang'iew oweyo paro e listing, obiro ka.",
    draft: true,
    page: "Shop",
    notes: "Review. Review text itself stays as written.",
  },
  report_shop: { en: "Report this shop", dholuo: "Ngol duka ni", draft: true, page: "Shop", notes: "Review." },
  sign_in_report: { en: "Sign in to report this shop", dholuo: "Donj mondo ingol duka ni", draft: true, page: "Shop", notes: "Review." },
  whatsapp_name: { en: "WhatsApp {name}", dholuo: "WhatsApp {name}", draft: true, page: "Shop", notes: "{name} is the shop name, unchanged." },
  checked_by: { en: "Checked by Rangach", dholuo: "Rangach ong'ere", draft: true, page: "Shop", notes: "Review." },
  close_checks: { en: "Close checks", dholuo: "Lor ranyisi", draft: true, page: "Shop", notes: "Review." },
  shop_sections: { en: "Shop sections", dholuo: "Kuonde mag duka", draft: true, page: "Shop", notes: "Review. Screen-reader label." },
  shop_video: { en: "Shop video", dholuo: "Video mar duka", draft: true, page: "Shop", notes: "Review." },
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

/** Full draft list for a native speaker. */
export function dholuoStringsMarkdown(): string {
  const lines = [
    "# Dholuo UI drafts",
    "",
    "Every Dholuo line is a draft (`draft: true`) until a native speaker signs off.",
    "Seller titles, descriptions, bios, offerings, and reviews are not in this list.",
    "",
    "| Key | Page | English | Dholuo draft | Notes |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [key, row] of Object.entries(UI_STRINGS)) {
    lines.push(`| ${key} | ${cell(row.page)} | ${cell(row.en)} | ${cell(row.dholuo)} | ${cell(row.notes)} |`);
  }
  return `${lines.join("\n")}\n`;
}
