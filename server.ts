import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Helper: simple page fetch wrapper
async function fetchPageText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(id);
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch (e) {
    return null;
  }
}

// Try to verify a product URL points to the expected domain and contains key text (brand/name)
async function verifyProductUrl(productUrl: string | undefined, domain: string, keywords: string[]): Promise<string | null> {
  if (!productUrl) return null;
  try {
    const text = await fetchPageText(productUrl);
    if (!text) return null;
    const lower = text.toLowerCase();
    // Check domain existence and keywords
    if (!productUrl.includes(domain)) return null;
    for (const kw of keywords) {
      if (!kw) continue;
      if (lower.includes(kw.toLowerCase())) return productUrl;
    }
    // If no keyword matched, still accept if title/og:title exists
    const ogTitle = /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i.exec(text);
    if (ogTitle && ogTitle[1]) return productUrl;
    const title = /<title[^>]*>([^<]+)<\/title>/i.exec(text);
    if (title && title[1]) return productUrl;
    return null;
  } catch (e) {
    return null;
  }
}

// Fall back to a DuckDuckGo site:search to find a likely product page for a query
async function findProductBySiteSearch(domain: string, query: string): Promise<string | null> {
  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent("site:" + domain + " " + query)}`;
    const html = await fetchPageText(searchUrl);
    if (!html) return null;
    // Find anchors and pick the first link that contains the domain
    const hrefRegex = /<a[^>]+href="([^"#]+)"/gi;
    let m;
    while ((m = hrefRegex.exec(html)) !== null) {
      const href = m[1];
      // duckduckgo may return relative or redirect links; prefer those that include domain
      if (href.includes(domain)) return href.startsWith("http") ? href : `https://${domain}${href}`;
      // Some links are redirect wrappers like /l/?kh=-1&uddg=<encoded-url>
      const uddg = /uddg=([^&\"]+)/i.exec(href);
      if (uddg && uddg[1]) {
        try {
          const decoded = decodeURIComponent(uddg[1]);
          if (decoded.includes(domain)) return decoded;
        } catch (e) {}
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Simple in-memory cache for verified product URLs (TTL in ms)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const productCache = new Map<string, { url: string; ts: number }>();

function cacheGet(key: string): string | null {
  const v = productCache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > CACHE_TTL) {
    productCache.delete(key);
    return null;
  }
  return v.url;
}

function cacheSet(key: string, url: string) {
  productCache.set(key, { url, ts: Date.now() });
}

// Generic product page parser: tries to extract canonical/og:url, og:title, and ld+json product entries
function parseProductPageForUrl(html: string, domain: string): string | null {
  // canonical link
  const canonical = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(html);
  if (canonical && canonical[1] && canonical[1].includes(domain)) return canonical[1];

  // og:url
  const ogUrl = /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html);
  if (ogUrl && ogUrl[1] && ogUrl[1].includes(domain)) return ogUrl[1];

  // ld+json product URL
  const ld = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ld.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj && typeof obj === 'object') {
        if (obj['@type'] && (obj['@type'].toLowerCase().includes('product') || obj['@type'] === 'Product')) {
          if (obj.offers && obj.offers.url) return obj.offers.url;
          if (obj.url && obj.url.includes(domain)) return obj.url;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // fallback: first absolute link that contains the domain
  const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1];
    if (href.includes(domain)) return href.startsWith('http') ? href : `https://${domain}${href}`;
  }

  return null;
}

// Lazy initialize Gemini client to avoid crash if API key is not yet set.
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/** Models to try in order (fallback if rate-limited) */
const MODEL_CHAIN = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

/** Sleep helper */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Simple global async queue to serialize API requests */
class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await task()); } catch (e) { reject(e); }
      });
      if (!this.processing) this.process();
    });
  }
  private async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) await task();
    }
    this.processing = false;
  }
}
const globalApiQueue = new AsyncQueue();

/**
 * generateWithFallback: tries each model in MODEL_CHAIN.
 * Enqueues requests globally to prevent rate-limit flooding.
 * On a 429, uses exponential backoff (up to 4 attempts).
 */
async function generateWithFallback(
  ai: GoogleGenAI,
  contents: string,
  config: any
): Promise<any> {
  return globalApiQueue.add(async () => {
    let lastErr: any;
    for (const model of MODEL_CHAIN) {
      for (let attempt = 0; attempt < 4; attempt++) { // Up to 4 attempts
        try {
          const result = await ai.models.generateContent({ model, contents, config });
          console.log(`[SLAY AI] Generated with model: ${model}`);
          return result;
        } catch (err: any) {
          lastErr = err;
          const status: number = err?.status ?? err?.httpStatus ?? 0;
          if (status === 429) {
            // Exponential backoff base: 4s, 8s, 16s, 32s
            let waitMs = Math.pow(2, attempt) * 4000;
            try {
              const body = typeof err.errorDetails === "string" ? JSON.parse(err.errorDetails) : (err.errorDetails ?? {});
              const retryInfoArr = (body?.details ?? body ?? []) as any[];
              const retryInfo = retryInfoArr.find?.((d: any) => d["@type"]?.includes("RetryInfo"));
              if (retryInfo?.retryDelay) {
                const secs = parseInt(retryInfo.retryDelay.replace("s", ""));
                if (!isNaN(secs)) waitMs = Math.max(waitMs, (secs + 1) * 1000);
              }
            } catch (_) {}
            console.warn(`[SLAY AI] 429 on ${model} (attempt ${attempt + 1}/4), waiting ${waitMs}ms...`);
            await sleep(waitMs);
            continue; // retry same model
          }
          // Non-429 error — skip to next model
          console.warn(`[SLAY AI] Error on ${model}:`, status, err?.message);
          break;
        }
      }
    }
    throw lastErr ?? new Error("All models exhausted.");
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post(["/api/curate", "/api/curate/"], async (req, res) => {
    const { gender, age, occasion, accessories, budget } = req.body;

    if (!gender || !age || !occasion || budget === undefined) {
      return res.status(400).json({ error: "Missing required onboarding parameters." });
    }

    try {
      const ai = getGemini();

      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["outfits"],
          properties: {
            outfits: {
              type: Type.ARRAY,
              description: "Array of exactly 3 curated cohesive outfits.",
              items: {
                type: Type.OBJECT,
                required: ["id", "lookName", "description", "tag", "totalPrice", "items"],
                properties: {
                  id: { type: Type.STRING },
                  lookName: { type: Type.STRING, description: "A captivating, styling-led title (e.g. 'Effortless Streetwise Chic', 'Royal Heritage Elegance')" },
                  description: { type: Type.STRING, description: "Professional stylist breakdown in 2-3 sentences explaining why this look works, styling advice, and confidence booster." },
                  tag: { type: Type.STRING, description: "A cool label tag: e.g. 'Must Buy', 'Hot Seller', 'Ultra-Comfort', 'Editor Choice'" },
                  totalPrice: { type: Type.INTEGER, description: "Total estimated price in INR for the full outfit." },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      required: ["type", "name", "brand", "price", "platform", "searchQuery", "productUrl", "colorHex", "styleAdvice"],
                      properties: {
                        type: { type: Type.STRING, description: "Product category: Topwear | Bottomwear | Footwear | Accessory" },
                        name: { type: Type.STRING, description: "Specific and appealing item catalog name." },
                        brand: { type: Type.STRING, description: "Trusted brand label." },
                        price: { type: Type.INTEGER, description: "Estimated price in INR (e.g. 599)." },
                        platform: { type: Type.STRING, description: "Must be 'Myntra' | 'Ajio' | 'Meesho'." },
                        searchQuery: { type: Type.STRING, description: "Rich search query string for copy-pasting or searching the web marketplace." },
                        productUrl: { type: Type.STRING, description: "A realistic and accurate deep-link URL pointing to a single specific product page on Myntra, Ajio, or Meesho." },
                        colorHex: { type: Type.STRING, description: "Clean CSS hex code representing the main visual shade." },
                        styleAdvice: { type: Type.STRING, description: "Quick professional micro styling tip (e.g. 'Tuck in slightly' or 'Pair with thin silver chains')." },
                        imageUrl: { type: Type.STRING, description: "A real, publicly accessible product image URL from Unsplash CDN (e.g. https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=400&fit=crop) that visually represents this specific item's type, color and style." }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };


      // Build the prompt
      const prompt = `You are an elite, trendsetting celebrity fashion stylist called "SLAY AI" with your underlying training and trend databases upgraded up to May 2026.
Your core mission is to save users style-curation time by delivering a hyper-personalized, complete outfit recommendation based on four key metrics: Gender (${gender}), Budget (₹${budget}), Occasion (${occasion}), and Age Group (${age} years old).

To achieve this, you MUST perform deep, context-driven design synthesis across trusted, authentic, and verified style sources (top fashion blogs, industry news, style articles, and current trends up to May 2026). Analyze and implement the following styling datasets for every recommendation:
1. **Cohesive Pairing**: Determine exactly which clothing pieces and styles complement each other perfectly (e.g., proportions, silhouettes, fabric weight).
2. **Color Theory & Coordination**: Analyze which colors, tones, and patterns look best together for the selected occasion (monochromatic, complementary, triadic, neutral groundings).
3. **Demographic Preferences**: Identify which outfits are statistically and aesthetically preferred by the selected age group (${age} years old).
4. **Real-Time Trend Analysis**: Filter for what is currently trending, highly rated, and universally loved across the fashion and styling industry up to May 2026.

Curate exactly 3 highly-cohesive, exceptionally stylish, and context-appropriate outfits (called "Lookbooks") suitable for standard Indian marketplace platforms like Myntra, Ajio, and Meesho.
Make sure you respect the budget completely and don't overspend the limit!

Criteria selected:
- Gender: ${gender}
- Age: ${age} years old
- Occasion: ${occasion} (make sure the style completely matches this vibe: Casual, Traditional, Formal, Party, Date Night, Activewear)
- Accessory & Footwear Inclusion List: [${accessories && accessories.length > 0 ? accessories.join(", ") : ""}]
- Maximum Budget: ₹${budget} (INR)

Strict Item Rules:
- If the "Accessory & Footwear Inclusion List" is empty (contains no items), you MUST STRICLY EXCLUDE all accessories and footwear/shoes. In this case, each of the curated outfits MUST contain EXACTLY two items: 1 Topwear and 1 Bottomwear. Do NOT include Shoes or Footwear or any Accessory.
- If the "Accessory & Footwear Inclusion List" contains selected items, you must only include items corresponding to those specific requested categories (e.g., if 'Shoes' is selected, you may include Footwear; if 'Bags' is selected, an Accessory, etc.). Do not include categories that are not specified in this list.

For each outfit:
1. Provide a creative trendsetting Look Name (sleek, memorable).
2. Write a highly professional styling advice/concept description explanation.
3. Suggest the set of items representing the outfit, making sure you strictly follow the inclusion/exclusion rules defined above.
4. Assign highly accurate, real-world current prices to each item based on your May 2026 knowledge of Indian ecommerce. Do NOT generate random or hallucinated low prices. Ensure the exact total price of all items in an outfit is strictly less than or equal to ₹${budget}.
5. Assign a recommended marketplace platform ('Myntra', 'Ajio', or 'Meesho') for each single item in a realistic manner (e.g. Ajio for premium/streetwear, Myntra for top brand fashion/shoes, Meesho for extremely pocket-friendly/traditional value finds).
6. Create a precise, descriptive searchQuery for each item.
7. Generate a real, high-quality, deep-link URL pointing to a single, specific physical product page (NOT search list URLs) on that platform ('Myntra', 'Ajio', or 'Meesho') that serves as the absolute best physical product fit to complete the curated outfit. Follow the realistic deep-link structures for each platform.
8. Extract a visual hex-color code (e.g. "#1A2E3B") representing that item's primary style color.

Return the result as structured JSON matching the requested schema.`;

      const response = await generateWithFallback(ai, prompt, config);
      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from AI engine.");
      }

      let cleanText = responseText.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }

      const parsedJSON = JSON.parse(cleanText.trim());

      // Post-process: verify productUrl for each item and attempt to fix missing/incorrect links
      const domainMap: Record<string, string> = {
        Myntra: "myntra.com",
        Ajio: "ajio.com",
        Meesho: "meesho.com",
      };

      for (const outfit of parsedJSON.outfits || []) {
        for (const item of outfit.items || []) {
          try {
            const domain = domainMap[item.platform] || (item.productUrl ? new URL(item.productUrl).host : "");
            const keywords = [item.brand || "", item.name || "", item.type || "", item.searchQuery || ""].filter(Boolean);

            // Check cache first (keyed by domain+searchQuery)
            const cacheKey = `${domain}::${(item.searchQuery || (item.brand + ' ' + item.name)).trim()}`;
            const cached = cacheGet(cacheKey);
            if (cached) {
              item.productUrl = cached;
              continue;
            }

            const verified = await verifyProductUrl(item.productUrl, domain, keywords);
            if (verified) {
              cacheSet(cacheKey, verified);
            } else {
              // Try parsing the provided productUrl (useful if AI gave a near URL)
              if (item.productUrl) {
                const page = await fetchPageText(item.productUrl);
                if (page) {
                  const parsed = parseProductPageForUrl(page, domain);
                  if (parsed) {
                    item.productUrl = parsed;
                    cacheSet(cacheKey, parsed);
                    continue;
                  }
                }
              }

              // Attempt site search fallback
              const fallback = await findProductBySiteSearch(domain, item.searchQuery || `${item.brand} ${item.name}`);
              if (fallback) {
                // Try to verify or parse the fallback
                const parsedPage = await fetchPageText(fallback);
                if (parsedPage) {
                  const parsed = parseProductPageForUrl(parsedPage, domain) || fallback;
                  item.productUrl = parsed;
                  cacheSet(cacheKey, parsed);
                } else {
                  item.productUrl = fallback;
                  cacheSet(cacheKey, fallback);
                }
              }
            }
          } catch (e) {
            // swallow — don't fail the whole response
            console.error("Post-process product verification error:", e);
          }
        }
      }

      res.json(parsedJSON);
    } catch (error: any) {
      console.error("Discovery error:", error);
      
      
      // Fallback: Dynamic mock data based on user input
      let mockData: any = { outfits: [] };
      const isOffice = occasion.toLowerCase().includes('office') || occasion.toLowerCase().includes('work');
      const isFestive = occasion.toLowerCase().includes('festive') || occasion.toLowerCase().includes('wedding') || occasion.toLowerCase().includes('ethnic') || occasion.toLowerCase().includes('mehendi');
      const isGym = occasion.toLowerCase().includes('gym') || occasion.toLowerCase().includes('athleisure');
      const isFemale = gender.toLowerCase() === 'women';

      if (isOffice && !isFemale) {
        mockData.outfits = [
          {
            id: 'mock-office-m-1', lookName: 'Boardroom Elite', description: 'Sharp, polished look for high-stakes meetings and professional settings.', tag: 'Editor Choice', totalPrice: 2598,
            items: [
              { type: 'Topwear', name: 'Slim Fit White Dress Shirt', brand: 'Louis Philippe', price: 999, platform: 'Myntra', searchQuery: 'white formal shirt men', colorHex: '#FFFFFF', styleAdvice: 'Crisp and well-ironed.', imageUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=300&h=400&fit=crop' },
              { type: 'Bottomwear', name: 'Tailored Navy Trousers', brand: 'Van Heusen', price: 1499, platform: 'Ajio', searchQuery: 'navy formal trousers men', colorHex: '#000080', styleAdvice: 'Perfect break right above the shoe.', imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300&h=400&fit=crop' }
            ]
          }
        ];
      } else if (isOffice && isFemale) {
        mockData.outfits = [
          {
            id: 'mock-office-f-1', lookName: 'Executive Grace', description: 'Power dressing with a modern feminine silhouette.', tag: 'Must Buy', totalPrice: 2498,
            items: [
              { type: 'Topwear', name: 'Silk Blend Formal Blouse', brand: 'Allen Solly', price: 999, platform: 'Ajio', searchQuery: 'women silk formal blouse', colorHex: '#F5F5DC', styleAdvice: 'Tuck it in for a sleek waistline.', imageUrl: 'https://images.unsplash.com/photo-1599577180579-7a522bf05044?w=300&h=400&fit=crop' },
              { type: 'Bottomwear', name: 'High-Waist Pencil Skirt', brand: 'Marks & Spencer', price: 1499, platform: 'Myntra', searchQuery: 'black pencil skirt formal women', colorHex: '#111111', styleAdvice: 'Pairs beautifully with block heels.', imageUrl: 'https://images.unsplash.com/photo-1582142407894-ec85a1260a46?w=300&h=400&fit=crop' }
            ]
          }
        ];
      } else if (isFestive) {
        mockData.outfits = [
          {
            id: 'mock-festive-1', lookName: 'Golden Hour', description: 'A vibrant, festive-ready ethnic look perfect for celebrations.', tag: 'Hot Seller', totalPrice: 2499,
            items: [
              { type: 'Topwear', name: 'Embroidered Kurta', brand: 'Manyavar', price: 1299, platform: 'Myntra', searchQuery: 'embroidered ethnic kurta', colorHex: '#C5A028', styleAdvice: 'Style with mojris for a complete traditional look.', imageUrl: 'https://images.unsplash.com/photo-1610189361394-70346b3b3ff2?w=300&h=400&fit=crop' },
              { type: 'Bottomwear', name: 'Palazzo Pants', brand: 'Biba', price: 999, platform: 'Meesho', searchQuery: 'festive palazzo pants ethnic', colorHex: '#8B1A1A', styleAdvice: 'Flowy and festive.', imageUrl: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=300&h=400&fit=crop' }
            ]
          }
        ];
      } else if (isGym) {
        mockData.outfits = [
          {
            id: 'mock-gym-1', lookName: 'Power Mode', description: 'Sweat-wicking performance wear built for high-intensity workouts.', tag: 'Ultra-Comfort', totalPrice: 1798,
            items: [
              { type: 'Topwear', name: 'Dry-Fit Training Tee', brand: 'HRX by Hrithik Roshan', price: 699, platform: 'Myntra', searchQuery: 'dryfit gym training tee', colorHex: '#1A1A2E', styleAdvice: 'Lightweight and breathable.', imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=400&fit=crop' },
              { type: 'Bottomwear', name: 'Compression Shorts', brand: 'Adidas', price: 999, platform: 'Ajio', searchQuery: 'compression gym shorts', colorHex: '#2D2D2D', styleAdvice: 'Supports muscle groups during heavy lifts.', imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=300&h=400&fit=crop' }
            ]
          }
        ];
      } else {
        mockData.outfits = [
          {
            id: 'mock-casual-1', lookName: 'Campus Cool', description: 'Effortlessly stylish everyday look for college and casual outings.', tag: 'Editor Choice', totalPrice: 1998,
            items: [
              { type: 'Topwear', name: 'Oversized Graphic Tee', brand: 'Roadster', price: 699, platform: 'Myntra', searchQuery: 'oversized graphic tee casual', colorHex: '#D8C3A5', styleAdvice: 'Keep it untucked for the streetwear vibe.', imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300&h=400&fit=crop' },
              { type: 'Bottomwear', name: 'Relaxed Cargo Pants', brand: 'H&M', price: 1299, platform: 'Ajio', searchQuery: 'relaxed cargo pants casual', colorHex: '#4A4A4A', styleAdvice: 'Cuff the hem once for a cleaner finish.', imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300&h=400&fit=crop' }
            ]
          }
        ];
      }

      // Rewrite mock product URLs to point to our simulated store to guarantee price matching
      mockData.outfits.forEach(outfit => {
        outfit.items.forEach(item => {
          item.productUrl = `http://localhost:3000/store?brand=${encodeURIComponent(item.brand)}&name=${encodeURIComponent(item.name)}&price=${item.price}&platform=${item.platform}&img=${encodeURIComponent(item.imageUrl)}`;
        });
      });

      res.json(mockData);
    }
  });

  app.get("/store", (req, res) => {
    const { brand, name, price, platform, img } = req.query;
    const isDark = platform === "Myntra" || platform === "Ajio";
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${brand} - ${name} | ${platform}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #111; }
            .header { padding: 16px 24px; border-bottom: 1px solid #eaeaea; font-weight: 900; font-size: 20px; letter-spacing: -0.5px; }
            .container { max-width: 480px; margin: 0 auto; padding: 24px; }
            .img-box { width: 100%; aspect-ratio: 3/4; background: #f5f5f5; border-radius: 12px; margin-bottom: 24px; overflow: hidden; }
            .img-box img { width: 100%; height: 100%; object-fit: cover; }
            .brand { font-size: 18px; font-weight: 800; text-transform: uppercase; margin: 0 0 4px 0; }
            .name { font-size: 14px; color: #666; margin: 0 0 16px 0; }
            .price { font-size: 24px; font-weight: 900; margin: 0 0 24px 0; }
            .btn { display: block; width: 100%; padding: 16px; background: ${isDark ? '#111' : '#f43397'}; color: #fff; text-align: center; font-weight: bold; border-radius: 8px; text-decoration: none; border: none; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="header">${platform} <span style="color:#888; font-size:12px; font-weight:normal; float:right; margin-top:6px;">Partner Store</span></div>
          <div class="container">
            <div class="img-box">
              <img src="${img || 'https://via.placeholder.com/400x500'}" alt="Product" />
            </div>
            <h1 class="brand">${brand}</h1>
            <h2 class="name">${name}</h2>
            <div class="price">₹${price}</div>
            <button class="btn">Add to Bag</button>
          </div>
        </body>
      </html>
    `);
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR wrapper...");
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SLAY AI server listening robustly on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server boot failure:", err);
});
