import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { CATEGORIES, regionForCity, type Category } from "../src/lib/constants";
import { assessScam } from "../src/lib/scam";

const prisma = new PrismaClient();
const password = "demo1234";

const users: {
  email: string;
  name: string;
  role: string;
  kind: string;
  city: string;
  phone: string;
  whatsapp: string;
  bio: string;
  verifiedPro?: boolean;
}[] = [
  {
    email: "akinyi@dala.local",
    name: "Akinyi Admin",
    role: "admin",
    kind: "person",
    city: "Nairobi",
    phone: "+254711000100",
    whatsapp: "+254711000100",
    bio: "Moderates the Dala demo. This account can hide listings and grant the verified badge.",
  },
  {
    email: "atieno@dala.local",
    name: "Atieno Odhiambo",
    role: "user",
    kind: "business",
    city: "Nairobi",
    phone: "+254711000101",
    whatsapp: "+254711000101",
    bio: "Runs Mama Atieno's Kitchen in Kilimani and takes weekend catering bookings.",
  },
  {
    email: "okello@dala.local",
    name: "David Okello",
    role: "user",
    kind: "business",
    city: "London",
    phone: "+447400000201",
    whatsapp: "+447400000201",
    verifiedPro: true,
    bio: "Solicitor in Stratford. Advises Kenyan families in the UK on housing and small-business paperwork.",
  },
  {
    email: "grace@dala.local",
    name: "Grace Awuor",
    role: "user",
    kind: "business",
    city: "Nairobi",
    phone: "+254711000103",
    whatsapp: "+254711000103",
    bio: "Braider and the person who answers for Nyadhi Beauty Studio in South B.",
  },
  {
    email: "mary@dala.local",
    name: "Mary Adhiambo",
    role: "user",
    kind: "business",
    city: "Nairobi",
    phone: "+254711000104",
    whatsapp: "+254711000104",
    bio: "Trades and a small garage in Industrial Area. Also lists the odd item for sale.",
  },
  {
    email: "peter@dala.local",
    name: "Peter Owino",
    role: "user",
    kind: "business",
    city: "London",
    phone: "+447400000205",
    whatsapp: "+447400000205",
    bio: "Runs the Peckham grocer and a minicab line out of Thamesmead.",
  },
  {
    email: "achieng@dala.local",
    name: "Achieng Otieno",
    role: "user",
    kind: "person",
    city: "Nairobi",
    phone: "+254711000106",
    whatsapp: "+254711000106",
    bio: "Tutor and occasional classifieds poster in Nairobi.",
  },
  {
    email: "james@dala.local",
    name: "James Omondi",
    role: "user",
    kind: "person",
    city: "London",
    phone: "+447400000207",
    whatsapp: "+447400000207",
    bio: "Lives in Woolwich. Posts the odd room and reviews places after visits home.",
  },
];

type SeedListing = {
  owner: string;
  type: "business" | "for_sale" | "wanted" | "housing" | "services";
  title: string;
  description: string;
  category: Category;
  city: "Nairobi" | "London";
  address: string;
  priceLabel: string;
  verified?: boolean;
  featured?: boolean;
  hidden?: boolean;
};

const listings: SeedListing[] = [
  {
    owner: "atieno@dala.local",
    type: "business",
    title: "Mama Atieno's Kitchen",
    description:
      "Luo home cooking in Kilimani. Lunch plates with fish, ugali, and greens from KES 450. Weekend nyama by the tray if you book on Thursday. Seats about twenty, and we do office drops along Ngong Road.",
    category: "Food & restaurants",
    city: "Nairobi",
    address: "Argwings Kodhek Road, Kilimani",
    priceLabel: "From KES 450",
    verified: true,
    featured: true,
  },
  {
    owner: "grace@dala.local",
    type: "business",
    title: "Wuonwa Tax & Accounts",
    description:
      "Books and annual returns for small shops and salons. We sit with you and show the workings, then file. Bring last year's PIN certificate and your M-Pesa statements. Appointments in Upper Hill on weekdays.",
    category: "Professional services",
    city: "Nairobi",
    address: "Upper Hill",
    priceLabel: "From KES 8,000",
    verified: true,
  },
  {
    owner: "grace@dala.local",
    type: "business",
    title: "Nyadhi Beauty Studio",
    description:
      "Braids, twists, and cuts in South B. Book a chair on WhatsApp and say how long your hair is so we can quote the hours. We start on time when the client does. Walk-ins only if a stylist is free.",
    category: "Beauty & personal care",
    city: "Nairobi",
    address: "South B shopping centre",
    priceLabel: "From KES 1,500",
    featured: true,
  },
  {
    owner: "mary@dala.local",
    type: "business",
    title: "Jaluo Builders",
    description:
      "Masonry, kitchen refits, and small roof repairs. We work across Kariobangi, Umoja, and South C. Ask for a written quote before we buy materials. A site visit inside Nairobi is free.",
    category: "Construction & trades",
    city: "Nairobi",
    address: "Kariobangi",
    priceLabel: "",
  },
  {
    owner: "mary@dala.local",
    type: "business",
    title: "Lake Road Couriers",
    description:
      "Same-day parcels inside Nairobi and a weekday run to Kisumu if the bag is full. We do not ship shopping from abroad. Call before 10:00 if you need a pickup the same day.",
    category: "Transport & logistics",
    city: "Nairobi",
    address: "Industrial Area",
    priceLabel: "From KES 300",
  },
  {
    owner: "achieng@dala.local",
    type: "business",
    title: "Nyakongo Tutors",
    description:
      "After-school maths and English, plus Dholuo reading for children who are losing the language. Sessions at the student's home in Kilimani, South B, or Langata. Saturday group class at 9:00.",
    category: "Education & tutoring",
    city: "Nairobi",
    address: "Kilimani and South B",
    priceLabel: "KES 1,200 an hour",
  },
  {
    owner: "atieno@dala.local",
    type: "business",
    title: "Benga & Beyond Events",
    description:
      "PA, DJ, and a small benga set for weddings and fundraisers. We bring two speakers and a microphone. You provide the power and the tent. Book at least three weeks ahead in December.",
    category: "Events & entertainment",
    city: "Nairobi",
    address: "Westlands",
    priceLabel: "From KES 25,000",
  },
  {
    owner: "mary@dala.local",
    type: "business",
    title: "Jowi Auto Garage",
    description:
      "Brakes, suspension, and service for Toyota and Nissan. We explain the quote before we start and will show you the old part. Open Monday to Saturday in Industrial Area.",
    category: "Auto & mechanics",
    city: "Nairobi",
    address: "Industrial Area",
    priceLabel: "",
    verified: true,
  },
  {
    owner: "grace@dala.local",
    type: "business",
    title: "Ramogi Community Fellowship",
    description:
      "Sunday service at 10:00 in Umoja, mostly in Dholuo with a short English summary. Choir practice on Thursday evening. Visitors are welcome. This is a fictional congregation for the demo.",
    category: "Faith & community orgs",
    city: "Nairobi",
    address: "Umoja 2",
    priceLabel: "",
  },
  {
    owner: "mary@dala.local",
    type: "business",
    title: "Adhiambo Mitumba",
    description:
      "Second-hand clothes, sorted by size, in Eastleigh. Bales are not sold to the public. We open the new pile on Tuesday morning. Cash or M-Pesa at the stall.",
    category: "Retail / shops",
    city: "Nairobi",
    address: "Eastleigh, 1st Avenue",
    priceLabel: "",
  },
  {
    owner: "grace@dala.local",
    type: "business",
    title: "Thuon Wellness",
    description:
      "A small clinic on Ngong Road for colds, blood pressure checks, and referrals. This is not an emergency room. A clinician is in from 8:00 to 16:00 on weekdays. Call if you are bringing a child.",
    category: "Health & wellness",
    city: "Nairobi",
    address: "Ngong Road",
    priceLabel: "Consultation KES 1,000",
    verified: true,
  },
  {
    owner: "atieno@dala.local",
    type: "business",
    title: "Akinyi's Catering",
    description:
      "Trays for meetings and home gatherings: fish, beef, rice, and greens. Minimum order is ten plates. We deliver inside Nairobi before 11:00 if you confirm the night before.",
    category: "Food & restaurants",
    city: "Nairobi",
    address: "South C",
    priceLabel: "From KES 600 a plate",
  },
  {
    owner: "peter@dala.local",
    type: "business",
    title: "Lake & Nile Kitchen",
    description:
      "Fish stew, ugali, and plantain in Peckham. Busy on Saturday after the grocer next door opens. Book a table for more than four. We can do a takeaway tray if you message in the morning.",
    category: "Food & restaurants",
    city: "London",
    address: "Rye Lane, Peckham",
    priceLabel: "Mains from £12",
    verified: true,
    featured: true,
  },
  {
    owner: "okello@dala.local",
    type: "business",
    title: "Okello & Co Solicitors",
    description:
      "Housing, tenancy deposits, and small-business paperwork for Kenyan families in the UK. First call is fifteen minutes and free. We are not an immigration firm. Office near Stratford station.",
    category: "Professional services",
    city: "London",
    address: "Stratford",
    priceLabel: "From £80",
    verified: true,
  },
  {
    owner: "peter@dala.local",
    type: "business",
    title: "Tottenham Braids",
    description:
      "Box braids, knotless, and trims. The shop is a half-turn off the high street, so send a WhatsApp when you are close and we will step out. Quotes depend on length and style.",
    category: "Beauty & personal care",
    city: "London",
    address: "Tottenham High Road",
    priceLabel: "From £60",
  },
  {
    owner: "peter@dala.local",
    type: "business",
    title: "Homeland Minicabs",
    description:
      "Pre-booked cars from Thamesmead, Woolwich, and the City Airport. Confirm the fare on WhatsApp before the driver sets off. We are a local cab line, not a freight service.",
    category: "Transport & logistics",
    city: "London",
    address: "Thamesmead",
    priceLabel: "Airport from £35",
  },
  {
    owner: "okello@dala.local",
    type: "business",
    title: "Luo Saturday School",
    description:
      "Two hours on Saturday morning in Edmonton for children aged 5 to 12. Stories, songs, and reading in Dholuo, then a short English recap for parents. Term fees are paid monthly.",
    category: "Education & tutoring",
    city: "London",
    address: "Edmonton",
    priceLabel: "£25 a month",
  },
  {
    owner: "peter@dala.local",
    type: "business",
    title: "Ramogi Social Club",
    description:
      "A Friday social in Woolwich with music and a short community notice. Hall hire on Sunday afternoon if the church group is not using it. This is a fictional club for the demo.",
    category: "Events & entertainment",
    city: "London",
    address: "Woolwich",
    priceLabel: "Entry £5",
  },
  {
    owner: "okello@dala.local",
    type: "business",
    title: "Our Lady of the Lake Community",
    description:
      "A Catholic prayer group that meets after the English mass in Woolwich. Readings alternate between Dholuo and English. Newcomers can just turn up. Fictional group, not a parish.",
    category: "Faith & community orgs",
    city: "London",
    address: "Woolwich",
    priceLabel: "",
  },
  {
    owner: "peter@dala.local",
    type: "business",
    title: "East African Grocer",
    description:
      "Sukuma, dried fish, maize flour, and tea from home. Prices are marked on the shelf. If we are out of omena, the board by the till says when the next box lands. Peckham, near the station.",
    category: "Retail / shops",
    city: "London",
    address: "Peckham",
    priceLabel: "",
    verified: true,
  },
  {
    owner: "okello@dala.local",
    type: "business",
    title: "Awuor Wellbeing",
    description:
      "Private physiotherapy by appointment for back pain and post-natal checks. This is not a GP surgery and we do not prescribe. Clinic room in Stratford on Tuesday and Thursday evenings.",
    category: "Health & wellness",
    city: "London",
    address: "Stratford",
    priceLabel: "£55 a session",
  },
  {
    owner: "mary@dala.local",
    type: "for_sale",
    title: "Toyota Fielder 2012",
    description:
      "Silver Fielder, one owner, service file from Jowi Auto Garage. Viewing in Industrial Area on Saturday morning. Price is firm unless you are paying this month. Logbook is present.",
    category: "Auto & mechanics",
    city: "Nairobi",
    address: "Industrial Area",
    priceLabel: "KES 850,000",
  },
  {
    owner: "achieng@dala.local",
    type: "for_sale",
    title: "Three-seat sofa, South B",
    description:
      "Grey fabric sofa, no tears, from a non-smoking flat. Buyer collects from South B. I can send more photos on WhatsApp. Cash on collection.",
    category: "Retail / shops",
    city: "Nairobi",
    address: "South B",
    priceLabel: "KES 12,000",
  },
  {
    owner: "atieno@dala.local",
    type: "wanted",
    title: "Waiter who speaks Dholuo",
    description:
      "Mama Atieno's Kitchen needs a waiter for Friday and Saturday lunch. Experience in a small restaurant is enough. Pay is weekly. Come in after 15:00 and ask for Atieno.",
    category: "Food & restaurants",
    city: "Nairobi",
    address: "Kilimani",
    priceLabel: "",
  },
  {
    owner: "achieng@dala.local",
    type: "housing",
    title: "2-bed flat in Kilimani",
    description:
      "Two bedrooms, one bath, water tank on the roof. Available from the first of next month. Viewing on Sunday. Rent does not include electricity. No agency fee if you come through this listing.",
    category: "Real estate / housing",
    city: "Nairobi",
    address: "Kilimani, near Yaya",
    priceLabel: "KES 55,000 / month",
  },
  {
    owner: "james@dala.local",
    type: "housing",
    title: "Room in Peckham",
    description:
      "Single room in a shared house, ten minutes from the Luo church hall. Bills included. One month deposit, no holding fee. The house is quiet after 22:00. Available to view this weekend.",
    category: "Real estate / housing",
    city: "London",
    address: "Peckham",
    priceLabel: "£700 / month",
  },
  {
    owner: "atieno@dala.local",
    type: "services",
    title: "Wedding MC and DJ",
    description:
      "I host in Dholuo and English and play a benga set between the speeches. You bring the sound system, or I can hire one through Benga & Beyond. Deposit is 30 percent after we have met.",
    category: "Events & entertainment",
    city: "Nairobi",
    address: "Nairobi",
    priceLabel: "From KES 15,000",
  },
  {
    owner: "okello@dala.local",
    type: "services",
    title: "Self-assessment for Kenyans in the UK",
    description:
      "Help filing a UK self-assessment when you also have a small shop or a rental back home. I explain what HMRC is asking for. This is a bookkeeping session, not a full solicitor matter.",
    category: "Professional services",
    city: "London",
    address: "Stratford",
    priceLabel: "From £80",
  },
  {
    owner: "mary@dala.local",
    type: "for_sale",
    title: "Carved stools, set of four",
    description:
      "Four hand-carved wooden stools from a workshop in Kisumu. Solid, not flat-pack. Collection in Industrial Area or I can send them with Lake Road Couriers inside Nairobi.",
    category: "Retail / shops",
    city: "Nairobi",
    address: "Industrial Area",
    priceLabel: "KES 18,000",
  },
  {
    owner: "atieno@dala.local",
    type: "wanted",
    title: "Accountant for a small restaurant",
    description:
      "Looking for someone to close the monthly books for Mama Atieno's Kitchen. Two visits a month is enough. Please send a short note about shops you already keep books for.",
    category: "Professional services",
    city: "Nairobi",
    address: "Kilimani",
    priceLabel: "",
  },
  {
    owner: "james@dala.local",
    type: "housing",
    title: "Bedsit in Woolwich",
    description:
      "Studio with its own shower, shared kitchen. Close to the Elizabeth line. Couples considered. References from a previous landlord help. No fees beyond the deposit and first month.",
    category: "Real estate / housing",
    city: "London",
    address: "Woolwich",
    priceLabel: "£850 / month",
  },
  {
    owner: "peter@dala.local",
    type: "services",
    title: "Driving lessons in English and Dholuo",
    description:
      "Manual lessons around Thamesmead and Woolwich for learners who prefer instruction in Dholuo or English. Dual-control car. I am a working instructor; ask for the badge number on WhatsApp.",
    category: "Transport & logistics",
    city: "London",
    address: "Thamesmead",
    priceLabel: "£35 an hour",
  },
  {
    owner: "james@dala.local",
    type: "for_sale",
    title: "iPhone 13 128GB",
    description:
      "Black iPhone 13, battery health 88 percent, with the box. You can check the serial in person before you pay. Collection in Woolwich station. Price is not a bargain, it is a used phone.",
    category: "Retail / shops",
    city: "London",
    address: "Woolwich",
    priceLabel: "£220",
  },
  {
    owner: "mary@dala.local",
    type: "services",
    title: "Fundi for a kitchen refit in South C",
    description:
      "Two-week kitchen refit: tiles, sink, and cabinets you have already bought. I work with one assistant. Materials are yours. I invoice at the end of each week for labour only.",
    category: "Construction & trades",
    city: "Nairobi",
    address: "South C",
    priceLabel: "Labour KES 45,000",
  },
  {
    owner: "achieng@dala.local",
    type: "for_sale",
    title: "Limited offer sofa set",
    description:
      "Limited offer. 100% legit sofa set, act now. WhatsApp only. I will not give a collection address until you decide today.",
    category: "Retail / shops",
    city: "Nairobi",
    address: "Nairobi",
    priceLabel: "KES 8,000",
  },
  {
    owner: "james@dala.local",
    type: "for_sale",
    title: "Guaranteed plot return",
    description:
      "Guaranteed return on a plot. Double your money. Send the deposit via Western Union before any site visit. No inspection. Investment opportunity for diaspora buyers.",
    category: "Real estate / housing",
    city: "Nairobi",
    address: "Out of town",
    priceLabel: "KES 15,000 deposit",
  },
  {
    owner: "achieng@dala.local",
    type: "for_sale",
    title: "iPhone 15 Pro Max, pay first",
    description:
      "iPhone 15 Pro Max. Pay first via gift card before I show the phone. WhatsApp only. Price is far below any shop.",
    category: "Retail / shops",
    city: "Nairobi",
    address: "Nairobi",
    priceLabel: "KES 4,500",
    hidden: true,
  },
];

const reviews: { title: string; author: string; rating: number; body: string }[] = [
  {
    title: "Mama Atieno's Kitchen",
    author: "achieng@dala.local",
    rating: 5,
    body: "The fried tilapia was fresh and the lunch plate was enough food. Easy to find off Argwings Kodhek.",
  },
  {
    title: "Mama Atieno's Kitchen",
    author: "james@dala.local",
    rating: 4,
    body: "I ate here on a visit home. Solid ugali and greens. They replied on WhatsApp the same day.",
  },
  {
    title: "Nyadhi Beauty Studio",
    author: "atieno@dala.local",
    rating: 5,
    body: "Braids were neat and they started on time. Ask for Grace if you want the quote in one message.",
  },
  {
    title: "Jowi Auto Garage",
    author: "achieng@dala.local",
    rating: 4,
    body: "They explained the brake quote before starting and showed me the old pads.",
  },
  {
    title: "Thuon Wellness",
    author: "mary@dala.local",
    rating: 5,
    body: "The clinician listened and did not rush. I was referred on instead of being sold a tonic.",
  },
  {
    title: "Wuonwa Tax & Accounts",
    author: "mary@dala.local",
    rating: 5,
    body: "They filed the small-shop return and walked me through the figures before I signed.",
  },
  {
    title: "Lake & Nile Kitchen",
    author: "james@dala.local",
    rating: 5,
    body: "Proper fish stew in Peckham. Saturday is busy, so go early if you are with children.",
  },
  {
    title: "Lake & Nile Kitchen",
    author: "okello@dala.local",
    rating: 4,
    body: "Good food. The plantain side was smaller than I expected, and the bill matched the menu.",
  },
  {
    title: "Okello & Co Solicitors",
    author: "peter@dala.local",
    rating: 5,
    body: "Clear advice on a tenancy deposit. The fee was explained before any work started.",
  },
  {
    title: "East African Grocer",
    author: "james@dala.local",
    rating: 5,
    body: "Sukuma and dried fish were in stock. Prices on the shelf matched the till.",
  },
  {
    title: "Tottenham Braids",
    author: "okello@dala.local",
    rating: 4,
    body: "Book on WhatsApp. The shop is easy to miss from the high street, so ask them to step out.",
  },
  {
    title: "Homeland Minicabs",
    author: "james@dala.local",
    rating: 4,
    body: "Airport run was on time. Confirm the fare on WhatsApp before the car moves.",
  },
  {
    title: "2-bed flat in Kilimani",
    author: "james@dala.local",
    rating: 3,
    body: "Photos matched the flat. Replies were slow, so leave a day if you are only in Nairobi briefly.",
  },
  {
    title: "Room in Peckham",
    author: "peter@dala.local",
    rating: 5,
    body: "Quiet house. The rent included bills, as the advert said.",
  },
  {
    title: "Guaranteed plot return",
    author: "achieng@dala.local",
    rating: 1,
    body: "They asked for a Western Union deposit before any site visit. I did not send it.",
  },
];

async function main() {
  const unknown = listings.filter((listing) => !(CATEGORIES as readonly string[]).includes(listing.category));
  if (unknown.length > 0) {
    throw new Error(`Unknown categories: ${unknown.map((listing) => listing.category).join(", ")}`);
  }

  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.block.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(password, 10);
  const createdUsers = new Map<string, { id: string; name: string; phone: string; whatsapp: string }>();

  for (const user of users) {
    const created = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
        kind: user.kind,
        city: user.city,
        phone: user.phone,
        whatsapp: user.whatsapp,
        bio: user.bio,
        verifiedPro: user.verifiedPro ?? false,
      },
    });
    createdUsers.set(user.email, {
      id: created.id,
      name: created.name,
      phone: user.phone,
      whatsapp: user.whatsapp,
    });
  }

  const idsByTitle = new Map<string, string>();
  for (const [index, listing] of listings.entries()) {
    const owner = createdUsers.get(listing.owner);
    if (!owner) throw new Error(`Missing owner ${listing.owner}`);
    const risk = assessScam(listing);
    const created = await prisma.listing.create({
      data: {
        type: listing.type,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        city: listing.city,
        region: regionForCity(listing.city),
        address: listing.address,
        priceLabel: listing.priceLabel,
        contactName: owner.name,
        contactPhone: owner.phone,
        contactWhatsapp: owner.whatsapp,
        verified: listing.verified ?? false,
        featured: listing.featured ?? false,
        featuredUntil: listing.featured ? new Date(Date.now() + 30 * 86_400_000) : null,
        hidden: listing.hidden ?? false,
        scamRisk: risk.level,
        scamNotes: risk.notes,
        ownerId: owner.id,
        createdAt: new Date(Date.now() - (listings.length - index) * 6 * 3_600_000),
      },
    });
    idsByTitle.set(listing.title, created.id);
  }

  for (const review of reviews) {
    const listingId = idsByTitle.get(review.title);
    const author = createdUsers.get(review.author);
    if (!listingId || !author) throw new Error(`Bad review seed for ${review.title}`);
    await prisma.review.create({
      data: { listingId, authorId: author.id, rating: review.rating, body: review.body },
    });
  }

  const scamId = idsByTitle.get("Guaranteed plot return");
  const reporter = createdUsers.get("achieng@dala.local");
  const target = createdUsers.get("james@dala.local");
  if (!scamId || !reporter || !target) throw new Error("Missing scam report seed");
  await prisma.report.create({
    data: {
      listingId: scamId,
      targetUserId: target.id,
      reporterId: reporter.id,
      reason: "Scam or fraud",
      details: "Asked for a Western Union deposit before a viewing.",
      status: "open",
    },
  });

  const kitchenId = idsByTitle.get("Mama Atieno's Kitchen");
  const atieno = createdUsers.get("atieno@dala.local");
  const okello = createdUsers.get("okello@dala.local");
  if (!kitchenId || !atieno || !okello) throw new Error("Missing payment seed");

  await prisma.payment.create({
    data: {
      userId: atieno.id,
      listingId: kitchenId,
      product: "featured",
      method: "mpesa",
      amount: "KES 1,500",
      reference: "DALA-MPESA-0101",
      status: "paid",
      note: "Simulated checkout. No M-Pesa request and no card charge.",
    },
  });
  await prisma.payment.create({
    data: {
      userId: okello.id,
      product: "verified_pro",
      method: "card",
      amount: "£20",
      reference: "DALA-CARD-4242",
      status: "paid",
      note: "Simulated checkout. No M-Pesa request and no card charge.",
    },
  });

  const flagged = await prisma.listing.count({ where: { scamRisk: { not: "low" } } });
  console.log(`Seeded ${createdUsers.size} people, ${idsByTitle.size} listings, ${flagged} flagged.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
