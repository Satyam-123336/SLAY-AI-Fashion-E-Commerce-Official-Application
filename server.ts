import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Default fallback images just in case
const FALLBACK_IMG = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=400&fit=crop";

const serperCache = new Map<string, any[]>();

async function fetchSerperShopping(query: string) {
  if (serperCache.has(query)) {
    console.log(`[SLAY AI] Cache hit for "${query}"`);
    return serperCache.get(query);
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn("SERPER_API_KEY is missing. Returning empty array.");
    return [];
  }

  try {
    const res = await fetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, gl: "in" })
    });
    
    if (!res.ok) {
      console.error(`Serper API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const shoppingResults = data.shopping || [];
    if (shoppingResults.length > 0) {
      serperCache.set(query, shoppingResults);
    }
    return shoppingResults;
  } catch (error) {
    console.error("Error fetching from Serper:", error);
    return [];
  }
}

function parsePrice(priceStr: string | undefined): number {
  if (!priceStr) return 0;
  // Handle formats like "₹1,299", "Rs. 999", "1299"
  const cleaned = priceStr.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}

// Randomly shuffles an array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Map occasions to preset names and descriptions
const OCCASION_DATA: Record<string, { looks: string[], descriptions: string[] }> = {
  office: {
    looks: ["The Boardroom Edit", "Executive Polish", "Sharp & Sleek"],
    descriptions: [
      "A tailored, professional look designed to command the room with understated elegance.",
      "Crisp silhouettes and refined fabrics perfect for high-stakes meetings.",
      "Modern corporate wear that balances comfort with absolute authority."
    ]
  },
  festive: {
    looks: ["Golden Hour Traditional", "Festive Radiance", "Heritage Charm"],
    descriptions: [
      "Vibrant and deeply rooted in tradition, perfect for celebrations.",
      "Rich textures and cultural elegance combined into a show-stopping outfit.",
      "A celebration of heritage weaving classic cuts with modern vibrance."
    ]
  },
  gym: {
    looks: ["Performance Mode", "Active Flex", "Gym Ready"],
    descriptions: [
      "High-performance activewear built for maximum mobility and sweat wicking.",
      "Streamlined athletic fit designed to keep you cool under pressure.",
      "Engineered for endurance without compromising on sleek street-ready style."
    ]
  },
  casual: {
    looks: ["Streetwear Classic", "Weekend Effortless", "Campus Cool"],
    descriptions: [
      "Relaxed fits and effortless layering for perfect weekend styling.",
      "Comfort-first streetwear that looks casually put together.",
      "A versatile everyday ensemble that transitions smoothly from day to night."
    ]
  }
};

const DEFAULT_OCCASION = OCCASION_DATA.casual;

const searchCache = new Map<string, string>();

async function resolveDirectLink(item: any): Promise<string> {
  if (item.link && !item.link.includes("google.com/search")) {
    return item.link;
  }
  
  const query = `${item.title} ${item.source || ""}`.trim();
  if (searchCache.has(query)) {
    return searchCache.get(query)!;
  }

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return item.link || "";

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, gl: "in" })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.organic && data.organic.length > 0) {
        const directLink = data.organic[0].link;
        searchCache.set(query, directLink);
        return directLink;
      }
    }
  } catch (err) {
    console.error("Error resolving direct link:", err);
  }
  
  // Fallback to our naive search URL builder
  const source = (item.source || "").toLowerCase();
  const q = encodeURIComponent(item.title || "");
  if (source.includes("myntra")) return `https://www.myntra.com/search?q=${q}`;
  if (source.includes("ajio")) return `https://www.ajio.com/search/?text=${q}`;
  if (source.includes("amazon")) return `https://www.amazon.in/s?k=${q}`;
  if (source.includes("flipkart")) return `https://www.flipkart.com/search?q=${q}`;
  
  return item.link || "";
}

const CUELINKS_API_KEY = "0euXCF7bTcCsDgYQxgG-rIHSTvMSvgg5Hz1zGYHxfvc";

async function wrapWithCuelinks(originalUrl: string): Promise<string> {
  if (!originalUrl) return originalUrl;
  try {
    const res = await fetch("https://cuelinks.com/api/v2/links.json", {
      method: "POST",
      headers: {
        "Authorization": `Token token="${CUELINKS_API_KEY}"`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: originalUrl })
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.affiliate_url || originalUrl;
    }
    
    console.error(`[Cuelinks API] Failed with status ${res.status}`);
  } catch (err) {
    console.error("[Cuelinks API] Error:", err);
  }
  return originalUrl;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post(["/api/curate", "/api/curate/"], async (req, res) => {
    const { gender, age, occasion, accessories, budget } = req.body;

    if (!gender || !age || !occasion || budget === undefined) {
      return res.status(400).json({ error: "Missing required onboarding parameters." });
    }

    try {
      console.log(`[SLAY AI] Curating for ${gender}, ${occasion}, Budget: ₹${budget}`);

      // Determine outfit archetype based on occasion
      const occLower = occasion.toLowerCase();
      let occType = "casual";
      if (occLower.includes("office") || occLower.includes("work") || occLower.includes("formal")) occType = "office";
      if (occLower.includes("festive") || occLower.includes("wedding") || occLower.includes("traditional")) occType = "festive";
      if (occLower.includes("gym") || occLower.includes("active") || occLower.includes("sport")) occType = "gym";

      const archetype = OCCASION_DATA[occType] || DEFAULT_OCCASION;
      
      // Determine what components we need to fetch
      // For simplicity, we define 3 outfit combinations to provide variety
      
      // Fetch data for the categories
      // We will concurrently search for Topwear, Bottomwear, and optionally Footwear/Accessories
      const topwearQuery = `${gender} ${occLower} shirt top kurta in India`;
      const bottomwearQuery = `${gender} ${occLower} trousers jeans pants in India`;
      
      let accessoryQuery = "";
      if (accessories && accessories.length > 0) {
        accessoryQuery = `${gender} ${accessories[0]} in India`;
      }

      console.log(`[SLAY AI] Fetching from Serper...`);
      const [topwearResults, bottomwearResults, accessoryResults] = await Promise.all([
        fetchSerperShopping(topwearQuery),
        fetchSerperShopping(bottomwearQuery),
        accessoryQuery ? fetchSerperShopping(accessoryQuery) : Promise.resolve([])
      ]);

      // Filter function to sideline negative reviews (require >= 4.0 rating if present, or no rating)
      const filterAndSortProducts = (items: any[]) => {
        let valid = items.filter(item => {
          if (item.rating && item.rating < 4.0) return false;
          return true;
        });
        
        // Prioritize items WITH ratings
        valid.sort((a, b) => {
          const aScore = (a.rating || 0) * (a.ratingCount || 0);
          const bScore = (b.rating || 0) * (b.ratingCount || 0);
          return bScore - aScore;
        });

        return valid;
      };

      const topwearClean = filterAndSortProducts(topwearResults);
      const bottomwearClean = filterAndSortProducts(bottomwearResults);
      const accessoryClean = filterAndSortProducts(accessoryResults);

      if (topwearClean.length === 0 || bottomwearClean.length === 0) {
        throw new Error("Could not find enough matching products from search.");
      }

      const outfits = [];

      const topPool = topwearClean.slice(0, 10);
      const botPool = bottomwearClean.slice(0, 10);
      const accPool = accessoryClean.slice(0, 10);
      
      const allCombinations: any[] = [];
      for (const t of topPool) {
        for (const b of botPool) {
          if (accPool.length > 0) {
            for (const a of accPool) {
              const total = parsePrice(t.price) + parsePrice(b.price) + parsePrice(a.price);
              allCombinations.push({ t, b, a, total });
            }
          } else {
            const total = parsePrice(t.price) + parsePrice(b.price);
            allCombinations.push({ t, b, a: null, total });
          }
        }
      }

      // Filter combinations that fit the budget strictly
      let validCombinations = allCombinations.filter(c => c.total <= budget);
      
      // If none fit the budget, just take the absolute cheapest combinations available
      if (validCombinations.length === 0) {
        allCombinations.sort((x, y) => x.total - y.total);
        validCombinations = allCombinations.slice(0, 3);
      } else {
        validCombinations = shuffleArray(validCombinations);
      }

      for (let i = 0; i < 3; i++) {
        if (!validCombinations[i % validCombinations.length]) break;
        
        const combo = validCombinations[i % validCombinations.length];
        const selectedTop = combo.t;
        const selectedBot = combo.b;
        const selectedAcc = combo.a;
        let totalPrice = combo.total;
        
        // Fetch direct links exactly!
        let [topLink, botLink, accLink] = await Promise.all([
          resolveDirectLink(selectedTop),
          resolveDirectLink(selectedBot),
          selectedAcc ? resolveDirectLink(selectedAcc) : Promise.resolve("")
        ]);

        // Wrap the direct links with Cuelinks API to generate affiliate commissions
        [topLink, botLink, accLink] = await Promise.all([
          wrapWithCuelinks(topLink),
          wrapWithCuelinks(botLink),
          accLink ? wrapWithCuelinks(accLink) : Promise.resolve("")
        ]);

        const outfitItems = [
          {
            type: "Topwear",
            name: selectedTop.title || "Premium Topwear",
            brand: selectedTop.source || "Partner Brand",
            price: parsePrice(selectedTop.price),
            platform: selectedTop.source || "Myntra",
            searchQuery: topwearQuery,
            productUrl: topLink,
            colorHex: "#111111", // Default sleek color
            styleAdvice: "Ensure a crisp fit for maximum impact.",
            imageUrl: selectedTop.imageUrl || FALLBACK_IMG
          },
          {
            type: "Bottomwear",
            name: selectedBot.title || "Premium Bottomwear",
            brand: selectedBot.source || "Partner Brand",
            price: parsePrice(selectedBot.price),
            platform: selectedBot.source || "Myntra",
            searchQuery: bottomwearQuery,
            productUrl: botLink,
            colorHex: "#333333",
            styleAdvice: "Perfect length to break just above the ankle.",
            imageUrl: selectedBot.imageUrl || FALLBACK_IMG
          }
        ];

        // Add accessory if requested
        if (selectedAcc) {
          outfitItems.push({
            type: "Accessory",
            name: selectedAcc.title || "Premium Accessory",
            brand: selectedAcc.source || "Partner Brand",
            price: parsePrice(selectedAcc.price),
            platform: selectedAcc.source || "Myntra",
            searchQuery: accessoryQuery,
            productUrl: accLink,
            colorHex: "#D4AF37", // Gold accent
            styleAdvice: "The perfect finishing touch.",
            imageUrl: selectedAcc.imageUrl || FALLBACK_IMG
          });
        }
        
        outfits.push({
          id: `outfit-${Date.now()}-${i}`,
          lookName: archetype.looks[i % archetype.looks.length],
          description: archetype.descriptions[i % archetype.descriptions.length],
          tag: i === 0 ? "Must Buy" : i === 1 ? "Highly Rated" : "Editor Choice",
          totalPrice,
          items: outfitItems
        });
      }

      res.json({ outfits });
    } catch (error: any) {
      console.error("Curation error:", error);
      res.status(500).json({ error: "Failed to curate outfits." });
    }
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
