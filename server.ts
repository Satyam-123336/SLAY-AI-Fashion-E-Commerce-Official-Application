import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const FALLBACK_IMG = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=400&fit=crop";
const CUELINKS_API_KEY = "0euXCF7bTcCsDgYQxgG-rIHSTvMSvgg5Hz1zGYHxfvc";

// ─── In-memory cache ───────────────────────────────────────────────────────────
const serperCache = new Map<string, any[]>();
const searchCache = new Map<string, string>();

// ─── FASHION INTELLIGENCE: Occasion Profiles ──────────────────────────────────
interface OccasionProfile {
  looks: string[];
  descriptions: string[];
  styleAdvice: { top: string; bottom: string; accessory: string };
  colorPalette: string[];
  men: { top: string[]; bottom: string[] };
  women: { top: string[]; bottom: string[] };
  accessoryMap: Record<string, string[]>;
}

const OCCASION_PROFILES: Record<string, OccasionProfile> = {
  everyday: {
    looks: ["Campus Cool", "Effortless Everyday", "Streetwear Classic"],
    descriptions: [
      "Laid-back fits with modern edge — perfect for lectures, chai breaks, and spontaneous outings.",
      "Easy separates that look curated without trying too hard. Street-smart and campus-ready.",
      "A versatile everyday ensemble that transitions from morning classes to evening hangouts seamlessly.",
    ],
    styleAdvice: {
      top: "Opt for a relaxed-fit tee or oversized shirt — comfort is key, styling is secondary.",
      bottom: "Slim-fit joggers or straight-cut jeans work best for an all-day college look.",
      accessory: "Keep accessories minimal — a clean sneaker and a subtle watch elevate instantly.",
    },
    colorPalette: ["#3D3D3D", "#F5F0E8", "#8B7355", "#4A90D9", "#2C2C2C"],
    men: {
      top: ["men oversized t-shirt solid cotton streetwear India under 500", "men graphic tee college casual India Myntra Ajio", "men casual half sleeve shirt checks India under 800", "men polo t-shirt regular fit India affordable"],
      bottom: ["men slim fit jeans mid rise dark wash India under 1000", "men jogger pants casual college India under 700", "men cargo pants relaxed fit India streetwear affordable", "men chinos slim fit casual India Myntra under 900"],
    },
    women: {
      top: ["women oversized t-shirt crop top casual India under 500", "women co-ord set casual college India Myntra Ajio", "women relaxed fit shirt cotton casual India affordable", "women spaghetti top bralette casual India under 400"],
      bottom: ["women mom jeans high waist casual India under 900", "women mini skirt casual flared India Myntra under 600", "women wide leg trousers casual college India under 800", "women jogger pants cotton casual India under 600"],
    },
    accessoryMap: {
      Footwear: ["women white sneakers casual India under 800", "men white sneakers canvas India affordable"],
      "Bags & Clutches": ["women canvas tote bag casual India under 500", "men sling bag casual India affordable"],
      Jewellery: ["women minimal gold earrings casual India under 300", "women layered necklace casual India"],
      Sunglasses: ["women oversized sunglasses trendy India under 500", "men retro sunglasses casual India affordable"],
      Perfumes: ["women fruity floral perfume body mist India under 400", "men fresh citrus deodorant India affordable"],
      Watches: ["men casual digital watch India under 800", "women minimalist watch casual India under 700"],
    },
  },
  office: {
    looks: ["The Boardroom Edit", "Executive Polish", "Corporate Sharp"],
    descriptions: [
      "Tailored silhouettes and refined fabrics that command presence without sacrificing comfort.",
      "Crisp, structured pieces perfect for high-stakes meetings and client presentations.",
      "A modern corporate edit that balances authority with contemporary style confidence.",
    ],
    styleAdvice: {
      top: "Go for structured fits — a well-pressed formal shirt or a clean blazer elevates immediately.",
      bottom: "Straight-cut formal trousers in neutral tones are timeless and universally professional.",
      accessory: "A classic leather belt, subtle watch, and closed-toe formal shoes complete the power look.",
    },
    colorPalette: ["#1B1B2F", "#2C3E50", "#FFFFFF", "#8B8B8B", "#C8A951"],
    men: {
      top: ["men formal shirt slim fit solid white blue India under 800", "men formal blazer suit jacket India affordable office", "men half sleeve formal shirt checked office India under 700", "men mandarin collar formal shirt India under 900"],
      bottom: ["men formal trousers slim fit flat front India under 1000", "men formal pants regular fit office India under 800", "men chinos slim fit formal India Myntra under 900", "men dress pants office formal India affordable"],
    },
    women: {
      top: ["women formal blazer work office India Myntra under 1200", "women formal shirt tucked office India under 700", "women peplum top formal work India under 800", "women shirt collar blouse formal India affordable"],
      bottom: ["women formal trousers wide leg office India under 900", "women pencil skirt formal work India under 700", "women cigarette pants formal office India Myntra", "women formal palazzo pants office India under 800"],
    },
    accessoryMap: {
      Footwear: ["women block heel formal pumps India under 1000", "men formal oxford shoes leather India affordable"],
      "Bags & Clutches": ["women office tote bag leather look India under 800", "men formal messenger bag office India"],
      Jewellery: ["women pearl stud earrings office India under 400", "women minimal chain necklace formal India"],
      Sunglasses: ["women wayfarer sunglasses formal India under 600", "men aviator sunglasses professional India"],
      Perfumes: ["women professional musk perfume office India under 600", "men woody office fragrance India affordable"],
      Watches: ["men formal analog watch leather strap India under 1200", "women formal watch slim dial India under 1000"],
    },
  },
  fusion: {
    looks: ["Indo-Western Edge", "Cultural Remix", "Fusion Statement"],
    descriptions: [
      "Where tradition meets trend — traditional silhouettes reimagined with contemporary cuts and fabrics.",
      "A cultural remix that blends Indian craftsmanship with modern global aesthetics effortlessly.",
      "Bold statement dressing that celebrates heritage while speaking the language of modern fashion.",
    ],
    styleAdvice: {
      top: "A kurta with a contemporary cut or an ethnic jacket over a western base creates the perfect fusion.",
      bottom: "Palazzos, dhoti pants, or straight-cut pants pair beautifully with fusion tops.",
      accessory: "Oxidized jewellery or handcrafted footwear adds an authentic artisanal touch.",
    },
    colorPalette: ["#8B0000", "#D4AF37", "#1B4332", "#4A1942", "#F5E6D3"],
    men: {
      top: ["men indo western kurta short length designer India Myntra under 1000", "men printed ethnic casual kurta India Ajio affordable", "men nehru collar jacket ethnic India under 900", "men kurta shirt collar fusion India under 800"],
      bottom: ["men dhoti pants fusion ethnic India Myntra under 800", "men patiala salwar fusion India under 700", "men tapered pants ethnic fusion India Ajio", "men straight kurta pyjama India under 900"],
    },
    women: {
      top: ["women kurta crop top fusion India Myntra under 800", "women ethnic blouse mirror work India under 700", "women jacket kurti fusion India Ajio affordable", "women cape blouse ethnic fusion India under 900"],
      bottom: ["women palazzo pants ethnic India Myntra under 700", "women dhoti pants fusion India under 800", "women salwar fusion trendy India Ajio", "women sharara pants fusion India under 900"],
    },
    accessoryMap: {
      Footwear: ["women kolhapuri sandals ethnic India under 600", "men jutti ethnic India under 700 Myntra"],
      "Bags & Clutches": ["women potli bag ethnic India under 500", "women embroidered clutch India affordable"],
      Jewellery: ["women oxidized jhumka earrings India under 400", "women ethnic choker necklace India Myntra"],
      Sunglasses: ["women cat eye sunglasses retro India under 500", "men round frame sunglasses India affordable"],
      Perfumes: ["women oud floral perfume India under 600", "men sandalwood attar perfume India affordable"],
      Watches: ["women ethnic kada watch India under 800", "men ethnic leather strap watch India"],
    },
  },
  cafe: {
    looks: ["Café Chic", "Weekend Glow", "Brunch Ready"],
    descriptions: [
      "Effortlessly stylish pieces that photograph beautifully over avocado toast and cold brew.",
      "Polished but never overdressed — perfect for brunches, cafés, and relaxed social settings.",
      "A curated casual look that feels considered without looking like you tried too hard.",
    ],
    styleAdvice: {
      top: "A well-fitted linen shirt or a printed co-ord top signals relaxed sophistication.",
      bottom: "Linen or cotton pants in earthy tones pair beautifully with most café settings.",
      accessory: "Loafers, a structured mini bag, and dainty jewellery complete the aesthetic perfectly.",
    },
    colorPalette: ["#D2B48C", "#8FBC8F", "#F5DEB3", "#FFDAB9", "#696969"],
    men: {
      top: ["men linen shirt half sleeve casual India under 700", "men printed co-ord set top casual India Ajio", "men knit polo t-shirt weekend India under 600", "men abstract print casual shirt India Myntra"],
      bottom: ["men linen pants casual India under 800", "men cotton shorts casual weekend India under 500", "men chinos relaxed fit casual India under 900", "men cargo pants weekend India under 700"],
    },
    women: {
      top: ["women linen blouse puff sleeve casual India under 700", "women co-ord set floral print casual India Myntra", "women crop top minimal aesthetic India under 500", "women ruffle blouse casual weekend India"],
      bottom: ["women linen wide leg pants casual India under 800", "women mini skirt floral casual India Myntra under 600", "women pleated midi skirt weekend India under 700", "women cotton shorts casual India under 500"],
    },
    accessoryMap: {
      Footwear: ["women loafers casual India Myntra under 800", "men loafer shoes casual weekend India under 900"],
      "Bags & Clutches": ["women mini bag structured casual India under 700", "women woven straw bag casual India"],
      Jewellery: ["women dainty gold ring earring set India under 400", "women minimalist bracelet India affordable"],
      Sunglasses: ["women round sunglasses trendy India under 500", "men square frame sunglasses India affordable"],
      Perfumes: ["women fresh floral perfume body mist India under 400", "men aquatic weekend fragrance India"],
      Watches: ["women rose gold watch casual India under 800", "men minimalist casual watch India under 1000"],
    },
  },
  wedding: {
    looks: ["Wedding Guest Glam", "Mehendi Night Radiance", "Shaadi Season Edit"],
    descriptions: [
      "Elegant, festive dressing that strikes the perfect balance between celebration and sophistication.",
      "A vibrant, joyful look crafted for mehendi nights, sangeet ceremonies, and pre-wedding festivities.",
      "Luxurious fabrics and rich tones that capture the essence of Indian wedding celebrations.",
    ],
    styleAdvice: {
      top: "Opt for embroidered or embellished pieces — sequin, resham, or zari work adds instant festivity.",
      bottom: "Flared lehengas, sharara pants, or flowy skirts create movement and elegance.",
      accessory: "Statement jewellery is the soul of Indian wedding dressing — jhumkas, maang tikka, or chokers.",
    },
    colorPalette: ["#FFD700", "#FF69B4", "#800020", "#FF8C00", "#4B0082"],
    men: {
      top: ["men sherwani indo western wedding India Myntra under 2000", "men kurta embroidered wedding guest India under 1500", "men bandhgala jacket festive India Ajio under 1800", "men jodhpuri suit wedding India affordable"],
      bottom: ["men churidar pyjama silk look India under 800", "men dhoti pants festive India under 700", "men straight pyjama wedding India Myntra", "men salwar festive wedding India under 600"],
    },
    women: {
      top: ["women lehenga choli embroidered wedding guest India Myntra under 2000", "women saree silk look festive wedding India under 1500", "women anarkali suit embroidered India under 1800", "women sharara suit festive India Ajio affordable"],
      bottom: ["women flared lehenga skirt festive India under 1200", "women sharara wide leg festive India under 1000", "women organza skirt festive India Myntra", "women flared palazzo ethnic India under 800"],
    },
    accessoryMap: {
      Footwear: ["women embellished heels festive India under 1000", "men ethnic jutis wedding India under 800"],
      "Bags & Clutches": ["women embroidered clutch purse wedding India under 600", "women potli bag wedding India"],
      Jewellery: ["women kundan necklace earring set India under 800", "women jhumka earrings bridal India under 500"],
      Sunglasses: ["women embellished sunglasses festive India under 600", "men classic sunglasses festive India"],
      Perfumes: ["women oriental rose perfume festive India under 800", "men musk oud attar wedding India"],
      Watches: ["women stone studded watch festive India under 1000", "men dress watch wedding India under 1200"],
    },
  },
  festive: {
    looks: ["Golden Hour Traditional", "Festive Radiance", "Heritage Charm"],
    descriptions: [
      "Vibrant and deeply rooted in tradition — perfect for Diwali, Holi, Navratri, and Eid celebrations.",
      "Rich textures and cultural elegance combined into a show-stopping festive outfit.",
      "A celebration of heritage weaving classic Indian cuts with contemporary vibrancy.",
    ],
    styleAdvice: {
      top: "Block prints, bandhani, or embroidered kurtas reflect Indian festive culture authentically.",
      bottom: "Straight-cut pyjamas, dhoti, or flared skirts channel effortless festive grace.",
      accessory: "Oxidised or gold-toned jewellery and mojris/juttis complete the festive look.",
    },
    colorPalette: ["#FF8C00", "#FFD700", "#8B0000", "#006400", "#4B0082"],
    men: {
      top: ["men kurta cotton festive Diwali India Myntra under 1000", "men printed kurta ethnic festive India Ajio under 800", "men bandhani kurta festive India under 700", "men linen kurta festive India affordable under 900"],
      bottom: ["men kurta pyjama set festive India under 1200", "men straight fit pyjama ethnic India under 500", "men dhoti pants festive traditional India under 700", "men aligarh pyjama festive India under 600"],
    },
    women: {
      top: ["women anarkali kurti festive India Myntra under 1000", "women printed kurta ethnic festive India under 800", "women cotton kurta block print festive India under 700", "women bandhani kurti festive India Ajio"],
      bottom: ["women lehenga festive ethnic India under 1500", "women palazzo festive India Myntra under 700", "women flared skirt ethnic festive India under 800", "women straight salwar festive India affordable"],
    },
    accessoryMap: {
      Footwear: ["women ethnic juttis festive India under 700", "men mojri festive India under 600"],
      "Bags & Clutches": ["women potli bag festive India under 500", "women embroidered clutch festive India"],
      Jewellery: ["women kundan earrings festive India under 500", "women temple jewellery set India under 700"],
      Sunglasses: ["women oversized festive sunglasses India under 500", "men classic wayfarer festive India"],
      Perfumes: ["women floral festive attar India under 500", "men oud festive perfume India affordable"],
      Watches: ["women gold tone watch ethnic India under 800", "men traditional watch festive India"],
    },
  },
  gym: {
    looks: ["Performance Mode", "Active Flex", "Athleisure Pro"],
    descriptions: [
      "High-performance activewear engineered for maximum mobility, support, and sweat-wicking comfort.",
      "Streamlined athletic fits designed to keep you cool, dry, and motivated through any workout.",
      "Where gym performance meets street-ready style — built for training, styled for life.",
    ],
    styleAdvice: {
      top: "Look for moisture-wicking, four-way stretch fabrics — fit should allow full range of motion.",
      bottom: "Compression shorts or flex joggers optimize both performance and post-gym versatility.",
      accessory: "Sports shoes with proper cushioning are non-negotiable — invest here within budget.",
    },
    colorPalette: ["#000000", "#1C1C1C", "#FF4500", "#00CED1", "#FFFFFF"],
    men: {
      top: ["men dri-fit sports t-shirt gym India under 500", "men compression vest gym training India under 600", "men muscle fit round neck gym t-shirt India Myntra", "men sports polo gym India affordable under 400"],
      bottom: ["men gym shorts dry fit India under 500", "men track pants slim fit gym India under 700", "men compression shorts gym India under 600", "men jogger gym performance India under 800"],
    },
    women: {
      top: ["women sports bra medium impact gym India under 500", "women crop top athletic gym India Myntra under 400", "women zip-up sports jacket gym India under 700", "women gym tank top moisture wicking India"],
      bottom: ["women gym leggings high waist India under 700", "women cycling shorts gym India Myntra under 500", "women yoga pants high rise gym India under 800", "women gym shorts athletic India under 500"],
    },
    accessoryMap: {
      Footwear: ["women running shoes cushion India under 1200", "men gym training shoes India under 1000"],
      "Bags & Clutches": ["women gym duffle bag India under 700", "men gym bag sports India affordable"],
      Jewellery: ["women minimal stud earrings sports India under 200", "women hair band sports India"],
      Sunglasses: ["women sport wrap sunglasses India under 500", "men sport sunglasses UV India affordable"],
      Perfumes: ["women sports deodorant long lasting India under 300", "men sport deo body spray India affordable"],
      Watches: ["men fitness sports watch digital India under 800", "women fitness tracker band India under 1000"],
    },
  },
  vacation: {
    looks: ["Wanderlust Chic", "Holiday Mode", "Travel Ready"],
    descriptions: [
      "Light, breathable fabrics that photograph beautifully at Goa beaches or Manali hills.",
      "Effortless holiday dressing — versatile pieces that mix and match across destinations.",
      "A travel wardrobe curated for comfort, style, and Instagram-worthy moments from sunrise to sunset.",
    ],
    styleAdvice: {
      top: "Breezy linen or cotton pieces in vacation-ready prints — think stripes, florals, and sunset hues.",
      bottom: "Shorts, linen pants, or flowy skirts that handle heat while looking styled.",
      accessory: "A straw hat, slides, and a crossbody bag are the travel stylist's secret weapons.",
    },
    colorPalette: ["#FF6B6B", "#4ECDC4", "#F9CA24", "#FFFFFF", "#1A535C"],
    men: {
      top: ["men linen shirt vacation beach India under 700", "men floral print shirt holiday India Myntra under 600", "men striped half sleeve shirt travel India under 500", "men resort shirt casual travel India affordable"],
      bottom: ["men linen shorts vacation India under 600", "men beach shorts printed India Myntra under 500", "men travel cargo pants India under 800", "men jogger pants travel comfortable India under 700"],
    },
    women: {
      top: ["women floral co-ord set vacation India Myntra under 800", "women tie dye blouse beach India under 600", "women strapless beach top India under 500", "women printed crop blouse vacation India"],
      bottom: ["women flowy maxi skirt beach India under 700", "women shorts denim casual beach India under 600", "women linen pants travel casual India Myntra", "women wrap skirt beach vacation India under 600"],
    },
    accessoryMap: {
      Footwear: ["women slides beach flip flops India under 500", "men beach sliders casual India affordable"],
      "Bags & Clutches": ["women crossbody bag travel India under 700", "women beach tote wicker India"],
      Jewellery: ["women boho earrings beach India under 400", "women anklet beach India under 300"],
      Sunglasses: ["women oversized beach sunglasses India under 600", "men polarized travel sunglasses India"],
      Perfumes: ["women coconut tropical body mist India under 400", "men beach fresh spray India affordable"],
      Watches: ["men waterproof sports watch travel India under 1000", "women casual watch vacation India"],
    },
  },
};

// ─── Occasion keyword detector ─────────────────────────────────────────────────
function detectOccasion(occasionStr: string): string {
  const o = occasionStr.toLowerCase();
  if (o.includes("college") || o.includes("everyday") || o.includes("daily") || o.includes("campus")) return "everyday";
  if (o.includes("office") || o.includes("work") || o.includes("formal") || o.includes("corporate")) return "office";
  if (o.includes("fusion") || o.includes("indo") || o.includes("western")) return "fusion";
  if (o.includes("café") || o.includes("cafe") || o.includes("weekend") || o.includes("hangout") || o.includes("brunch")) return "cafe";
  if (o.includes("wedding") || o.includes("mehendi") || o.includes("sangeet") || o.includes("shaadi")) return "wedding";
  if (o.includes("festive") || o.includes("ethnic") || o.includes("diwali") || o.includes("eid") || o.includes("navratri") || o.includes("traditional")) return "festive";
  if (o.includes("gym") || o.includes("sport") || o.includes("active") || o.includes("athleisure") || o.includes("workout")) return "gym";
  if (o.includes("vacation") || o.includes("travel") || o.includes("beach") || o.includes("holiday") || o.includes("trip")) return "vacation";
  return "everyday";
}

// ─── Serper fetch with cache ───────────────────────────────────────────────────
async function fetchSerperShopping(query: string): Promise<any[]> {
  if (serperCache.has(query)) {
    console.log(`[CACHE HIT] "${query.slice(0, 40)}"`);
    return serperCache.get(query)!;
  }
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "in", num: 20 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.shopping || [];
    if (results.length > 0) serperCache.set(query, results);
    return results;
  } catch { return []; }
}

function parsePrice(priceStr: string | undefined): number {
  if (!priceStr) return 0;
  return parseInt(priceStr.replace(/[^0-9]/g, ""), 10) || 0;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function filterAndScore(items: any[], budgetForItem: number): any[] {
  return items
    .filter(item => {
      if (item.rating && item.rating < 3.8) return false;
      const price = parsePrice(item.price);
      if (price > 0 && price > budgetForItem * 1.4) return false;
      return true;
    })
    .map(item => {
      const rating = item.rating || 0;
      const reviews = Math.min(item.ratingCount || 0, 5000);
      const price = parsePrice(item.price);
      const priceScore = price > 0 && price <= budgetForItem ? 1 : 0.4;
      const score = (rating / 5) * 0.4 + (reviews / 5000) * 0.35 + priceScore * 0.25;
      return { ...item, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

async function fetchBestProducts(queries: string[]): Promise<any[]> {
  const selected = shuffleArray(queries).slice(0, 2);
  const results = await Promise.all(selected.map(q => fetchSerperShopping(q)));
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const batch of results) {
    for (const item of batch) {
      const key = (item.title || "").slice(0, 30).toLowerCase();
      if (!seen.has(key)) { seen.add(key); merged.push(item); }
    }
  }
  return merged;
}

async function resolveDirectLink(item: any): Promise<string> {
  if (item.link && !item.link.includes("google.com/search")) return item.link;
  const query = `${item.title} ${item.source || ""}`.trim();
  if (searchCache.has(query)) return searchCache.get(query)!;
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return item.link || "";
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "in" }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.organic?.[0]?.link) {
        searchCache.set(query, data.organic[0].link);
        return data.organic[0].link;
      }
    }
  } catch {}
  const source = (item.source || "").toLowerCase();
  const q = encodeURIComponent(item.title || "");
  if (source.includes("myntra")) return `https://www.myntra.com/search?q=${q}`;
  if (source.includes("ajio")) return `https://www.ajio.com/search/?text=${q}`;
  if (source.includes("amazon")) return `https://www.amazon.in/s?k=${q}`;
  if (source.includes("flipkart")) return `https://www.flipkart.com/search?q=${q}`;
  return item.link || "";
}

async function wrapWithCuelinks(originalUrl: string): Promise<string> {
  if (!originalUrl) return originalUrl;
  try {
    const res = await fetch("https://cuelinks.com/api/v2/links.json", {
      method: "POST",
      headers: { "Authorization": `Token token="${CUELINKS_API_KEY}"`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: originalUrl }),
    });
    if (res.ok) { const data = await res.json(); return data.affiliate_url || originalUrl; }
  } catch {}
  return originalUrl;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.post(["/api/curate", "/api/curate/"], async (req, res) => {
    const { gender, age, occasion, accessories, budget } = req.body;
    if (!gender || !age || !occasion || budget === undefined) {
      return res.status(400).json({ error: "Missing required onboarding parameters." });
    }

    try {
      const occType = detectOccasion(occasion);
      const profile = OCCASION_PROFILES[occType];

      // 70/30 budget allocation
      const clothingBudget = Math.floor(budget * 0.70);
      const accessoryBudget = Math.floor(budget * 0.30);
      const topBudget = Math.floor(clothingBudget * 0.55);
      const botBudget = clothingBudget - topBudget;

      const genderKey = gender.toLowerCase().includes("women") || gender.toLowerCase().includes("female") ? "women" : "men";

      const accTypes: string[] = Array.isArray(accessories) && accessories.length > 0 ? accessories : [];
      const firstAccType = accTypes[0] || null;
      const allAccQueries = firstAccType && profile.accessoryMap[firstAccType] ? profile.accessoryMap[firstAccType] : [];

      // Filter accessory queries strictly by gender — avoids men getting women's accessories and vice versa
      const genderPrefix = genderKey === "women" ? "women" : "men";
      const genderMatchedAccQueries = allAccQueries.filter(q => q.toLowerCase().startsWith(genderPrefix));
      const accQueries = genderMatchedAccQueries.length > 0 ? genderMatchedAccQueries : allAccQueries;

      console.log(`[SLAY AI] ${gender} | ${occType} | ₹${budget} | top ₹${topBudget} | acc ₹${accessoryBudget}`);

      const [topRaw, botRaw, accRaw] = await Promise.all([
        fetchBestProducts(profile[genderKey].top),
        fetchBestProducts(profile[genderKey].bottom),
        accQueries.length > 0 ? fetchBestProducts(accQueries) : Promise.resolve([]),
      ]);

      const topPool = filterAndScore(topRaw, topBudget).slice(0, 12);
      const botPool = filterAndScore(botRaw, botBudget).slice(0, 12);
      const accPool = filterAndScore(accRaw, accessoryBudget).slice(0, 12);

      if (topPool.length === 0 || botPool.length === 0) {
        return res.status(500).json({ error: "We're getting a ton of requests right now. Please try again in a moment!" });
      }

      const allCombinations: any[] = [];
      for (const t of topPool) {
        for (const b of botPool) {
          if (accPool.length > 0) {
            for (const a of accPool) {
              const total = parsePrice(t.price) + parsePrice(b.price) + parsePrice(a.price);
              if (total <= budget * 1.1) allCombinations.push({ t, b, a, total });
            }
          } else {
            const total = parsePrice(t.price) + parsePrice(b.price);
            if (total <= budget * 1.1) allCombinations.push({ t, b, a: null, total });
          }
        }
      }

      let validCombinations = allCombinations.length > 0
        ? shuffleArray(allCombinations)
        : topPool.flatMap(t => botPool.map(b => ({ t, b, a: null, total: parsePrice(t.price) + parsePrice(b.price) }))).sort((x, y) => x.total - y.total).slice(0, 3);

      const usedTopIds = new Set<string>();
      const usedBotIds = new Set<string>();
      const outfits = [];

      for (let i = 0; i < 3; i++) {
        let combo = validCombinations.find(c => !usedTopIds.has(c.t.title) && !usedBotIds.has(c.b.title))
          || validCombinations[i % validCombinations.length];
        if (!combo) break;

        usedTopIds.add(combo.t.title);
        usedBotIds.add(combo.b.title);

        const { t: selectedTop, b: selectedBot, a: selectedAcc } = combo;

        let [topLink, botLink, accLink] = await Promise.all([
          resolveDirectLink(selectedTop),
          resolveDirectLink(selectedBot),
          selectedAcc ? resolveDirectLink(selectedAcc) : Promise.resolve(""),
        ]);
        [topLink, botLink, accLink] = await Promise.all([
          wrapWithCuelinks(topLink),
          wrapWithCuelinks(botLink),
          accLink ? wrapWithCuelinks(accLink) : Promise.resolve(""),
        ]);

        const cp = profile.colorPalette;
        const outfitItems: any[] = [
          { type: "Topwear", name: selectedTop.title || "Premium Topwear", brand: selectedTop.source || "Fashion Brand", price: parsePrice(selectedTop.price), platform: selectedTop.source || "Myntra", searchQuery: profile[genderKey].top[0], productUrl: topLink, colorHex: cp[0] || "#111111", styleAdvice: profile.styleAdvice.top, imageUrl: selectedTop.imageUrl || FALLBACK_IMG },
          { type: "Bottomwear", name: selectedBot.title || "Premium Bottomwear", brand: selectedBot.source || "Fashion Brand", price: parsePrice(selectedBot.price), platform: selectedBot.source || "Myntra", searchQuery: profile[genderKey].bottom[0], productUrl: botLink, colorHex: cp[1] || "#333333", styleAdvice: profile.styleAdvice.bottom, imageUrl: selectedBot.imageUrl || FALLBACK_IMG },
        ];
        if (selectedAcc) {
          outfitItems.push({ type: firstAccType || "Accessory", name: selectedAcc.title || "Premium Accessory", brand: selectedAcc.source || "Fashion Brand", price: parsePrice(selectedAcc.price), platform: selectedAcc.source || "Myntra", searchQuery: accQueries[0] || "", productUrl: accLink, colorHex: cp[2] || "#D4AF37", styleAdvice: profile.styleAdvice.accessory, imageUrl: selectedAcc.imageUrl || FALLBACK_IMG });
        }

        outfits.push({
          id: `outfit-${Date.now()}-${i}`,
          lookName: profile.looks[i % profile.looks.length],
          description: profile.descriptions[i % profile.descriptions.length],
          tag: i === 0 ? "Must Buy" : i === 1 ? "Highly Rated" : "Editor's Choice",
          totalPrice: combo.total,
          items: outfitItems,
        });
      }

      if (outfits.length === 0) return res.status(500).json({ error: "No outfits curated. Please try increasing your budget." });
      return res.json({ outfits });

    } catch (error: any) {
      console.error("Curation error:", error);
      return res.status(500).json({ error: "Failed to curate outfits." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ SLAY AI server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => console.error("Critical server boot failure:", err));
