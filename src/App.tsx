import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart, Share2, ShoppingBag, RotateCw, SlidersHorizontal } from "lucide-react";
import { Gender, Occasion, Accessory, SlayOutfit, SlayItem } from "./types";
import Onboarding from "./Onboarding";
import {
  trackAppOpen, trackOnboardingStart, trackScreenView,
  trackCurateStart, trackCurateSuccess, trackCurateError,
  trackOutfitListView, trackOutfitCardView, trackOutfitDetailOpen,
  trackItemBuyClick, trackShareStart, trackShareSuccess,
  trackCarouselSwipe, trackMenuOpen, trackRestyle, trackSoundToggle,
  trackAccessoryToggle,
} from "./analytics";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic hash seed so the same item always gets the same image */
function strSeed(...parts: string[]): number {
  let h = 0;
  for (const p of parts)
    for (let i = 0; i < p.length; i++) h = ((h << 5) - h + p.charCodeAt(i)) | 0;
  return Math.abs(h) % 9999;
}

const TYPE_KEYWORDS: Record<string, string> = {
  Topwear:    "fashion,shirt,clothing",
  Bottomwear: "fashion,pants,jeans",
  Footwear:   "shoes,footwear,fashion",
  Accessory:  "watch,accessory,luxury",
};

const TYPE_ICON: Record<string, string> = {
  Topwear:    "checkroom",
  Bottomwear: "straighten",
  Footwear:   "ice_skating",
  Accessory:  "watch",
};

const PLATFORM_STYLE: Record<string, string> = {
  Myntra: "text-[#E61A5C] bg-[#FFF0F4] border-[#FCD2DC]",
  Ajio:   "text-stone-800 bg-stone-50 border-stone-200",
  Meesho: "text-pink-600 bg-pink-50 border-pink-100",
};

const PLATFORM_LABEL: Record<string, string> = {
  Myntra: "PREMIUM STORE",
  Ajio:   "EXCLUSIVE STORE",
  Meesho: "TRENDING STORE",
};

function getItemImageUrl(item: SlayItem, seed: number): string {
  if (item.imageUrl && (item.imageUrl.startsWith("http") || item.imageUrl.startsWith("data:"))) {
    return item.imageUrl;
  }
  const kw = TYPE_KEYWORDS[item.type] ?? "fashion,clothing";
  return `https://loremflickr.com/200/250/${encodeURIComponent(kw)}?lock=${seed}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  // ── Navigation
  const [screen, setScreen] = useState<"onboarding" | "curating" | "results">("onboarding");

  // ── Preferences
  const [gender, setGender]           = useState<Gender>("Women");
  const [age, setAge]                 = useState<number>(22);
  const [occasion, setOccasion]       = useState<Occasion>("Everyday & College");
  const [selectedAccessories, setSelectedAccessories] = useState<Accessory[]>(["Footwear"]);
  const [budget, setBudget]           = useState<number>(1500);

  // ── UI State
  const [isMuted, setIsMuted]                           = useState<boolean>(true);
  const [outfits, setOutfits]                           = useState<SlayOutfit[]>([]);
  const [savedOutfitIds, setSavedOutfitIds]             = useState<string[]>([]);
  const [errorMessage, setErrorMessage]                 = useState<string | null>(null);
  const [selectedOutfitDetail, setSelectedOutfitDetail] = useState<SlayOutfit | null>(null);
  const [showCopiedBadge, setShowCopiedBadge]           = useState<boolean>(false);
  const [activeIndex, setActiveIndex]                   = useState<number>(0);
  const [menuOpen, setMenuOpen]                         = useState<boolean>(false);
  const [showSplash, setShowSplash]                     = useState<boolean>(true);

  React.useEffect(() => {
    trackAppOpen();
    const t = setTimeout(() => {
      setShowSplash(false);
      trackOnboardingStart();
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  // Track screen transitions
  React.useEffect(() => {
    trackScreenView(screen);
  }, [screen]);

  // Track active outfit view when swiping in results
  React.useEffect(() => {
    if (screen === "results" && outfits.length > 0) {
      trackOutfitCardView(outfits[activeIndex], activeIndex);
    }
  }, [activeIndex, screen, outfits]);

  /** Track which item images have failed so we show the gradient fallback */
  const [brokenImgs, setBrokenImgs]                     = useState<Record<string, boolean>>({});

  // ── Sound
  const playBeep = useCallback((freq = 440, type: OscillatorType = "sine", duration = 0.08) => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }, [isMuted]);

  // ── API call
  const curateStartTimeRef = useRef<number>(0);
  const handleCurate = async () => {
    setScreen("curating");
    setErrorMessage(null);
    playBeep(520, "sine", 0.1);
    curateStartTimeRef.current = Date.now();

    // 🔥 Analytics: user tapped SLAY MY LOOK
    trackCurateStart({ gender, age, occasion, accessories: selectedAccessories, budget });

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "/api/curate";
      const payload = { gender, age, occasion, accessories: selectedAccessories, budget };
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = "Stylish curation failed. Let's retry!";
        try {
          const ct = response.headers.get("content-type");
          if (ct?.includes("application/json")) {
            const e = await response.json();
            if (e?.error) errorMsg = e.error;
          } else {
            const t = await response.text();
            if (t.toLowerCase().includes("<!doctype"))
              errorMsg = "Service is starting up. Please try again in a moment!";
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const ct = response.headers.get("content-type");
      if (!ct?.includes("application/json"))
        throw new Error("Unexpected server response. Please retry!");

      const data = await response.json();
      if (!data.outfits?.length)
        throw new Error("No outfits found. Try adjusting your budget or preferences!");

      const durationMs = Date.now() - curateStartTimeRef.current;

      setOutfits(data.outfits);
      setActiveIndex(0);
      setBrokenImgs({});
      setSelectedOutfitDetail(null);
      setScreen("results");
      playBeep(880, "sine", 0.15);

      // 🔥 Analytics: outfits successfully generated
      trackCurateSuccess({
        outfitCount: data.outfits.length,
        totalItems: data.outfits.reduce((s: number, o: SlayOutfit) => s + o.items.length, 0),
        occasion,
        budget,
        durationMs,
      });
      trackOutfitListView(data.outfits, occasion);

    } catch (err: any) {
      console.error("Curation error:", err);
      const msg = err.message || "Something went wrong. Tap to try again.";
      setErrorMessage(msg);
      setScreen("onboarding");
      // 🔥 Analytics: generation failed
      trackCurateError(msg, occasion, budget);
    }
  };

  const toggleAccessory = (acc: Accessory) => {
    playBeep(450, "sine", 0.04);
    setSelectedAccessories((prev) => {
      const isSelected = prev.includes(acc);
      trackAccessoryToggle(acc, !isSelected);
      return isSelected ? prev.filter((a) => a !== acc) : [...prev, acc];
    });
  };

  const toggleSaveOutfit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playBeep(680, "sine", 0.05);
    setSavedOutfitIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  /** Builds a self-contained branded share card PNG — all text embedded inside the image */
  const buildShareImage = async (outfit: SlayOutfit): Promise<File | null> => {
    const W = 800;
    // Dynamic height: header(80) + collage(420) + item rows(70*n) + footer(140)
    const HEADER_H = 80;
    const COLLAGE_H = 420;
    const ITEM_ROW_H = 68;
    const FOOTER_H = 140;
    const H = HEADER_H + COLLAGE_H + outfit.items.length * ITEM_ROW_H + FOOTER_H;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // ─── Helpers ───────────────────────────────────────────────────
    const fillRoundRect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };

    const loadImg = (src: string): Promise<HTMLImageElement | null> =>
      new Promise((res) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });

    const drawCoverImg = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      ctx.restore();
    };

    // ─── 1. HEADER ─────────────────────────────────────────────────
    // Purple gradient header
    const headerGrad = ctx.createLinearGradient(0, 0, W, HEADER_H);
    headerGrad.addColorStop(0, "#4b41e1");
    headerGrad.addColorStop(1, "#6c5ce7");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, HEADER_H);

    // SLAY AI wordmark
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Inter, Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("SLAY AI", 32, HEADER_H / 2);

    // Tag badge (right side)
    const TAG = (outfit.tag || "SLAY PICK").toUpperCase();
    ctx.font = "bold 12px Inter, Arial, sans-serif";
    const tagW = ctx.measureText(TAG).width + 24;
    fillRoundRect(W - tagW - 28, HEADER_H / 2 - 14, tagW, 28, 14, "rgba(255,255,255,0.20)");
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(TAG, W - 28 - 12, HEADER_H / 2);

    // ─── 2. IMAGE COLLAGE ──────────────────────────────────────────
    const imgItems = outfit.items.filter(it => it.imageUrl);
    const loaded = await Promise.all(imgItems.map(it => loadImg(it.imageUrl!)));
    const imgs = loaded
      .map((img, i) => ({ img, item: imgItems[i] }))
      .filter(x => x.img !== null) as { img: HTMLImageElement; item: typeof imgItems[0] }[];

    const CY = HEADER_H; // collage starts here

    if (imgs.length === 0) {
      const grd = ctx.createLinearGradient(0, CY, W, CY + COLLAGE_H);
      grd.addColorStop(0, (outfit.items[0]?.colorHex || "#4b41e1") + "88");
      grd.addColorStop(1, "#1c1b1b");
      ctx.fillStyle = grd;
      ctx.fillRect(0, CY, W, COLLAGE_H);
    } else if (imgs.length === 1) {
      drawCoverImg(imgs[0].img, 0, CY, W, COLLAGE_H);
    } else if (imgs.length === 2) {
      const hw = Math.floor(W / 2);
      drawCoverImg(imgs[0].img, 0, CY, hw - 1, COLLAGE_H);
      drawCoverImg(imgs[1].img, hw + 1, CY, W - hw - 1, COLLAGE_H);
    } else if (imgs.length === 3) {
      const lw = Math.floor(W * 0.56);
      drawCoverImg(imgs[0].img, 0, CY, lw - 1, COLLAGE_H);
      const rh = Math.floor(COLLAGE_H / 2);
      drawCoverImg(imgs[1].img, lw + 1, CY, W - lw - 1, rh - 1);
      drawCoverImg(imgs[2].img, lw + 1, CY + rh + 1, W - lw - 1, COLLAGE_H - rh - 1);
    } else {
      const hw = Math.floor(W / 2), rh = Math.floor(COLLAGE_H / 2);
      drawCoverImg(imgs[0].img, 0, CY, hw - 1, rh - 1);
      drawCoverImg(imgs[1].img, hw + 1, CY, W - hw - 1, rh - 1);
      drawCoverImg(imgs[2].img, 0, CY + rh + 1, hw - 1, COLLAGE_H - rh - 1);
      drawCoverImg(imgs[3].img, hw + 1, CY + rh + 1, W - hw - 1, COLLAGE_H - rh - 1);
    }

    // Dark gradient overlay at bottom of collage
    const fade = ctx.createLinearGradient(0, CY + COLLAGE_H - 80, 0, CY + COLLAGE_H);
    fade.addColorStop(0, "rgba(13,13,13,0)");
    fade.addColorStop(1, "rgba(13,13,13,0.85)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, CY + COLLAGE_H - 80, W, 80);

    // Look name overlaid on collage bottom
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px Inter, Arial, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "left";
    ctx.fillText(outfit.lookName, 28, CY + COLLAGE_H - 18);

    // Colour strip at very bottom of collage
    const stripH = 5;
    const stripW = W / outfit.items.length;
    outfit.items.forEach((item, i) => {
      ctx.fillStyle = item.colorHex || "#4b41e1";
      ctx.fillRect(i * stripW, CY + COLLAGE_H - stripH, stripW, stripH);
    });

    // ─── 3. ITEM BREAKDOWN (white section) ─────────────────────────
    const ITEMS_Y = HEADER_H + COLLAGE_H;
    ctx.fillStyle = "#f9f8f8";
    ctx.fillRect(0, ITEMS_Y, W, outfit.items.length * ITEM_ROW_H);

    outfit.items.forEach((item, i) => {
      const rowY = ITEMS_Y + i * ITEM_ROW_H;

      // Subtle divider (except first)
      if (i > 0) {
        ctx.strokeStyle = "#ececec";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(28, rowY);
        ctx.lineTo(W - 28, rowY);
        ctx.stroke();
      }

      // Colour dot
      ctx.fillStyle = item.colorHex || "#aaa";
      ctx.beginPath();
      ctx.arc(44, rowY + ITEM_ROW_H / 2, 10, 0, Math.PI * 2);
      ctx.fill();

      // Type label
      fillRoundRect(64, rowY + ITEM_ROW_H / 2 - 12, 90, 24, 6, "#f0eefe");
      ctx.fillStyle = "#4b41e1";
      ctx.font = "bold 11px Inter, Arial, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(item.type.toUpperCase(), 72, rowY + ITEM_ROW_H / 2);

      // Item name + brand
      ctx.fillStyle = "#1c1b1b";
      ctx.font = "bold 15px Inter, Arial, sans-serif";
      ctx.fillText(`${item.brand}`, 170, rowY + ITEM_ROW_H / 2 - 9);
      ctx.fillStyle = "#6b7280";
      ctx.font = "13px Inter, Arial, sans-serif";
      // Truncate name if too long
      let name = item.name;
      while (name.length > 2 && ctx.measureText(name).width > W - 310) name = name.slice(0, -4) + "…";
      ctx.fillText(name, 170, rowY + ITEM_ROW_H / 2 + 9);

      // Price (right aligned)
      ctx.fillStyle = "#1c1b1b";
      ctx.font = "bold 16px 'Courier New', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`₹${item.price.toLocaleString("en-IN")}`, W - 28, rowY + ITEM_ROW_H / 2);
      ctx.textAlign = "left";
    });

    // ─── 4. FOOTER ─────────────────────────────────────────────────
    const FY = ITEMS_Y + outfit.items.length * ITEM_ROW_H;
    ctx.fillStyle = "#1c1b1b";
    ctx.fillRect(0, FY, W, FOOTER_H);

    // Total row
    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 12px Inter, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("TOTAL OUTFIT COST", 32, FY + 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.fillText(`₹${outfit.totalPrice.toLocaleString("en-IN")}`, 32, FY + 42);

    // Platform badges
    const platforms = ["Myntra", "Ajio", "Meesho"];
    let bx = W - 28;
    ctx.font = "bold 11px Inter, Arial, sans-serif";
    platforms.reverse().forEach((p) => {
      const pw = ctx.measureText(p).width + 20;
      bx -= pw;
      fillRoundRect(bx, FY + 28, pw, 24, 12, "rgba(255,255,255,0.10)");
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(p, bx + 10, FY + 40);
      bx -= 8;
    });

    // Divider
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, FY + 88); ctx.lineTo(W - 32, FY + 88);
    ctx.stroke();

    // Footer branding line
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px Inter, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("Curated by SLAY AI  ·  slay-ai.app  ·  3 fits. 30 seconds. In your budget.", 32, FY + 100);

    return new Promise((res) => {
      canvas.toBlob((blob) => {
        if (!blob) { res(null); return; }
        res(new File([blob], `slay-ai-${outfit.lookName.replace(/\s+/g, "-")}.png`, { type: "image/png" }));
      }, "image/png");
    });
  };

  const handleShare = async (e: React.MouseEvent, outfit: SlayOutfit) => {
    e.stopPropagation();
    playBeep(720, "sine", 0.05);
    trackShareStart(outfit.lookName, outfit.totalPrice);

    const appUrl = window.location.origin;
    const shareTitle = `SLAY AI - ${outfit.lookName}`;
    // Caption is short — all details are embedded inside the shared PNG card
    const shareText = `\u2728 Found my look on SLAY AI! "${outfit.lookName}" for \u20b9${outfit.totalPrice.toLocaleString("en-IN")} \ud83d\udc8e\nCurate yours \u2192 ${appUrl}`;

    // Try to share with image file
    if (navigator.share) {
      try {
        const file = await buildShareImage(outfit);
        const shareData: ShareData = file && navigator.canShare?.({ files: [file] })
          ? { title: shareTitle, text: shareText, files: [file] }
          : { title: shareTitle, text: shareText, url: appUrl };
        await navigator.share(shareData);
        setShowCopiedBadge(true);
        setTimeout(() => setShowCopiedBadge(false), 2200);
        trackShareSuccess("native_share", outfit.lookName);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }

    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = shareText;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setShowCopiedBadge(true);
    setTimeout(() => setShowCopiedBadge(false), 2200);
    trackShareSuccess("clipboard", outfit.lookName);
  };

  /** DuckDuckGo !bang redirect — lands directly on the product search page */
  const getBuyLink = (item: SlayItem) => {
    if (item.productUrl && item.productUrl.startsWith("http")) return item.productUrl;
    const query = item.searchQuery || `${item.brand} ${item.name} ${item.type}`;
    const domain =
      item.platform === "Myntra" ? "myntra.com" :
      item.platform === "Ajio"   ? "ajio.com"   : "meesho.com";
    return `https://duckduckgo.com/?q=!ducky+${encodeURIComponent(`site:${domain} ${query}`)}`;
  };

  const markImgBroken = (key: string) =>
    setBrokenImgs((prev) => ({ ...prev, [key]: true }));

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      id="slay-vibe-root"
      className="bg-[#fdf8f8] font-body-md text-[#1c1b1b] min-h-screen flex justify-center"
    >
      <main className="w-full max-w-app bg-[#fdf8f8] min-h-screen relative flex flex-col shadow-2xl md:shadow-none border-x border-[#c4c7c7]/30">

        {/* ── SPLASH SCREEN ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showSplash && (
            <motion.div
              key="splash-screen"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                className="flex flex-col items-center"
              >
                <h1 className="font-display text-[54px] font-black tracking-tighter text-white mb-3">
                  SLAY AI
                </h1>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-[1px] bg-white/20" />
                  <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-stone-400">
                    Your Personal Stylist
                  </p>
                  <div className="w-10 h-[1px] bg-white/20" />
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-[#fdf8f8]/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-[#c4c7c7]/30">
          <h1 className="font-display text-[24px] font-black tracking-tighter text-black">
            SLAY AI
          </h1>
          <button
            aria-label="Open menu"
            onClick={() => { trackMenuOpen(); setMenuOpen(true); playBeep(400, "sine", 0.04); }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-black" style={{ fontSize: 22 }}>menu</span>
          </button>
        </header>

        {/* ── SIDEBAR MENU ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {menuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="menu-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={() => setMenuOpen(false)}
              />
              {/* Drawer */}
              <motion.aside
                key="menu-drawer"
                initial={{ opacity: 0, scale: 0.95, y: -10, x: 0, transformOrigin: "top right" }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute top-4 right-4 h-fit max-h-[85vh] w-[280px] bg-white z-50 flex flex-col shadow-2xl rounded-[28px] border border-stone-100 overflow-hidden"
              >
                {/* Drawer header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100">
                  <span className="font-display text-[18px] font-black tracking-tighter text-black">
                    SLAY AI
                  </span>
                  <button
                    onClick={() => { setMenuOpen(false); playBeep(350, "sine", 0.04); }}
                    className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-center"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4 text-stone-700" />
                  </button>
                </div>

                {/* Drawer body */}
                <div className="overflow-y-auto no-scrollbar px-6 py-5 space-y-6">
                  {/* Tagline */}
                  <p className="text-[13px] text-stone-500 leading-relaxed">
                    Think of me as your personal digital stylist. I'll put together 3 fits in 30 seconds - all within your budget.
                  </p>

                  {/* How it works */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
                      How It Works
                    </h3>
                    <div className="space-y-3.5">
                      {[
                        { icon: "tune",           text: "Set your style preferences" },
                        { icon: "auto_awesome",   text: "SLAY AI curates 3 lookbooks" },
                        { icon: "style",          text: "Tap cards to view outfit details" },
                        { icon: "shopping_bag",   text: "Buy from Myntra, Ajio & many more trusted brands" },
                      ].map(({ icon, text }, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-stone-600" style={{ fontSize: 16 }}>
                              {icon}
                            </span>
                          </div>
                          <span className="text-[13px] text-stone-700 font-medium leading-snug">{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Platforms */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">
                      Shop From
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: "Myntra", cls: "text-[#E61A5C] bg-[#FFF0F4] border-[#FCD2DC]" },
                        { name: "Ajio",   cls: "text-[#2c3e50] bg-[#f8f9fa] border-[#e9ecef]" },
                        { name: "Meesho", cls: "text-[#9F2089] bg-[#FDF0F9] border-[#F7D4EE]" },
                        { name: "& More...", cls: "text-stone-500 bg-stone-50 border-stone-200" },
                      ].map((shop, i) => (
                        <span
                          key={shop.name}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${shop.cls}`}
                        >
                          {shop.name}
                        </span>
                      ))}
                    </div>
                  </div>


                </div>

                {/* Drawer footer */}
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100">
                  <p className="text-[11px] font-bold text-stone-400 text-center tracking-widest uppercase">
                    © 2026 FLASHFUSION LABS PRIVATE LIMITED
                  </p>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── PAGES CONTAINER ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col relative overflow-hidden">

          <AnimatePresence mode="wait">

            {/* ────────────────────────────────────────────────────────────── */}
            {/* SCREEN 1 — ONBOARDING (Preference Builder)                    */}
            {/* ────────────────────────────────────────────────────────────── */}
            {screen === "onboarding" && (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="flex-1 flex flex-col"
              >
                <Onboarding
                  gender={gender}
                  setGender={(g) => { setGender(g); playBeep(520, "sine", 0.04); }}
                  age={age}
                  setAge={(n) => { setAge(n); playBeep(250 + n * 3, "sine", 0.01); }}
                  occasion={occasion}
                  setOccasion={(o) => { setOccasion(o); playBeep(600, "sine", 0.04); }}
                  selectedAccessories={selectedAccessories}
                  toggleAccessory={toggleAccessory}
                  budget={budget}
                  setBudget={(n) => { setBudget(n); playBeep(350 + n / 100, "sine", 0.01); }}
                  handleCurate={handleCurate}
                  errorMessage={errorMessage}
                />
              </motion.div>
            )}

            {/* ────────────────────────────────────────────────────────────── */}
            {/* SCREEN 2 — CURATING (Animated Loader)                         */}
            {/* ────────────────────────────────────────────────────────────── */}
            {screen === "curating" && (
              <motion.div
                key="curating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12"
              >
                {/* Dual-ring spinner */}
                <div className="relative w-20 h-20 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 rounded-full border-[1.5px] border-stone-100 border-t-black animate-spin" />
                  <div
                    className="absolute inset-[6px] rounded-full border-[1.5px] border-stone-100 border-b-[#4b41e1] animate-spin"
                    style={{ animationDirection: "reverse", animationDuration: "1.3s" }}
                  />
                  <span className="material-symbols-outlined text-stone-700" style={{ fontSize: 20 }}>
                    auto_awesome
                  </span>
                </div>

                <h4 className="font-display text-[18px] font-black text-black uppercase tracking-tight mb-6">
                  Curating Your Lookbook
                </h4>

                {/* Step indicators */}
                <div className="w-full max-w-[220px] mx-auto space-y-3 text-left">
                  {[
                    "Analyzing style preferences",
                    "Matching trend databases",
                    "Building your lookbooks",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[#4b41e1] animate-pulse"
                          style={{ animationDelay: `${i * 0.45}s` }}
                        />
                      </div>
                      <span className="text-[11px] text-stone-500 font-medium text-left">{step}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ────────────────────────────────────────────────────────────── */}
            {/* SCREEN 3 — RESULTS (Swipeable Card Deck)                      */}
            {/* ────────────────────────────────────────────────────────────── */}
            {screen === "results" && outfits.length > 0 && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="flex-1 flex flex-col px-5 pt-3 pb-2"
              >
                {/* ── Control bar */}
                <div className="flex gap-2 items-center border-b border-stone-100 pb-3 mb-2">
                  <button
                    type="button"
                    onClick={() => { setScreen("onboarding"); playBeep(400, "sine", 0.08); }}
                    aria-label="Edit preferences"
                    className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-stone-700 hover:text-black transition-all bg-stone-50 hover:bg-stone-100 border border-stone-200 px-3 py-2 rounded-xl"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                    <span>Preferences</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { trackRestyle(); handleCurate(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-stone-700 hover:text-black transition-all bg-stone-50 hover:bg-stone-100 border border-stone-200 px-3 py-2 rounded-xl"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Regenerate</span>
                  </button>
                </div>

                {/* Context pill */}
                <div className="text-center mb-1">
                  <span className="text-[9px] text-stone-400 font-bold uppercase tracking-widest">
                    {gender} · {occasion} · ₹{budget.toLocaleString("en-IN")} cap
                  </span>
                </div>

                {/* ── Card Deck */}
                <div className="relative flex-1 w-full flex items-center justify-center" style={{ minHeight: 330 }}>
                  {outfits.map((outfit, index) => {
                    const isActive   = index === activeIndex;
                    const offset     = index - activeIndex;
                    const isVisible  =
                      Math.abs(offset) <= 1 ||
                      (index === 2 && activeIndex === 0) ||
                      (index === 0 && activeIndex === 2);
                    if (!isVisible) return null;

                    const isSaved = savedOutfitIds.includes(outfit.id);

                    return (
                      <motion.div
                        key={outfit.id}
                        drag="x"
                        dragConstraints={{ left: -120, right: 120 }}
                        dragElastic={0.35}
                        onDragEnd={(_, info) => {
                          if (info.offset.x > 75) {
                            setActiveIndex((p) => (p - 1 + 3) % 3);
                            playBeep(580, "sine", 0.1);
                          } else if (info.offset.x < -75) {
                            setActiveIndex((p) => (p + 1) % 3);
                            playBeep(640, "sine", 0.1);
                          }
                        }}
                        animate={{
                          scale:   isActive ? 1 : 0.93,
                          y:       isActive ? 0 : 12 * offset,
                          rotate:  isActive ? 0 : 3 * offset,
                          zIndex:  isActive ? 30 : 20 - Math.abs(offset),
                          opacity: isActive ? 1 : 0.38,
                        }}
                        transition={{ type: "spring", stiffness: 290, damping: 25 }}
                        onClick={() => {
                          if (isActive) {
                            trackOutfitDetailOpen(outfit, index);
                            setSelectedOutfitDetail(outfit);
                            playBeep(480, "triangle", 0.05);
                          } else {
                            setActiveIndex(index);
                            playBeep(520, "sine", 0.05);
                          }
                        }}
                        className="absolute bg-[#1c1b1b] rounded-2xl overflow-hidden shadow-2xl cursor-pointer select-none flex flex-col border border-[#2a2a2a]"
                        style={{ width: "92%", height: 310 }}
                      >
                        {/* ── TOP 65%: Visual Collage ─────────────────────────────── */}
                        <div className="relative overflow-hidden flex-shrink-0" style={{ height: "62%" }}>
                          {/* Dynamic image grid based on item count */}
                          {(() => {
                            const imgs = outfit.items.filter(it => it.imageUrl).slice(0, 4);
                            const count = imgs.length;
                            if (count === 0) {
                              // Gradient placeholder
                              return (
                                <div className="w-full h-full" style={{
                                  background: `linear-gradient(135deg, ${outfit.items[0]?.colorHex || '#4b41e1'}44, ${outfit.items[1]?.colorHex || '#1c1b1b'}88, #1c1b1b)`
                                }} />
                              );
                            }
                            if (count === 1) {
                              return <img src={imgs[0].imageUrl} alt={imgs[0].name} className="w-full h-full object-cover" />;
                            }
                            if (count === 2) {
                              return (
                                <div className="w-full h-full flex gap-0.5">
                                  {imgs.map((img, i) => (
                                    <div key={i} className="flex-1 relative overflow-hidden">
                                      <img src={img.imageUrl} alt={img.name} className="w-full h-full object-cover" />
                                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/80">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white">{img.type}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            if (count === 3) {
                              return (
                                <div className="w-full h-full flex gap-0.5">
                                  <div className="w-[55%] relative overflow-hidden">
                                    <img src={imgs[0].imageUrl} alt={imgs[0].name} className="w-full h-full object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/80">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-white">{imgs[0].type}</span>
                                    </div>
                                  </div>
                                  <div className="flex-1 flex flex-col gap-0.5">
                                    {imgs.slice(1).map((img, i) => (
                                      <div key={i} className="flex-1 relative overflow-hidden">
                                        <img src={img.imageUrl} alt={img.name} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/80">
                                          <span className="text-[8px] font-black uppercase tracking-widest text-white">{img.type}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            // 4 items: 2×2 grid
                            return (
                              <div className="w-full h-full grid grid-cols-2 gap-0.5">
                                {imgs.map((img, i) => (
                                  <div key={i} className="relative overflow-hidden">
                                    <img src={img.imageUrl} alt={img.name} className="w-full h-full object-cover" />
                                    <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/80">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-white">{img.type}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Gradient fade into bottom section */}
                          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#1c1b1b] to-transparent pointer-events-none" />

                          {/* Floating tag top-left */}
                          <div className="absolute top-2.5 left-2.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white bg-[#4b41e1] px-2.5 py-1 rounded-full shadow-lg">
                              {outfit.tag || "SLAY PICK"}
                            </span>
                          </div>

                          {/* Share top-right */}
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleShare(e, outfit)}
                              aria-label="Share outfit"
                              className="p-1.5 rounded-full bg-[#1c1b1b]/70 backdrop-blur-sm border border-white/10 hover:bg-[#1c1b1b] transition-colors"
                            >
                              <Share2 className="h-3 w-3 text-white/60" />
                            </button>
                          </div>
                        </div>

                        {/* ── BOTTOM 38%: Info ─────────────────────────────────────── */}
                        <div className="flex flex-col justify-between px-3.5 pt-2.5 pb-3 flex-1">
                          {/* Look name + colour palette */}
                          <div>
                            <h4 className="font-display text-[13px] font-extrabold tracking-tight text-white line-clamp-1 mb-1.5">
                              {outfit.lookName}
                            </h4>
                            {/* Colour strip */}
                            <div className="flex gap-1 mb-2">
                              {outfit.items.map((item, ci) => (
                                <div
                                  key={ci}
                                  title={`${item.type}: ${item.colorHex}`}
                                  className="h-[3px] flex-1 rounded-full"
                                  style={{ backgroundColor: item.colorHex || "#e5e2e1" }}
                                />
                              ))}
                            </div>
                            {/* Compact item pills */}
                            <div className="flex flex-wrap gap-1">
                              {outfit.items.slice(0, 3).map((item, ii) => (
                                <span key={ii} className="flex items-center gap-1 bg-[#252424] border border-[#333] rounded-full px-2 py-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.colorHex || "#ccc" }} />
                                  <span className="text-[8px] font-semibold text-stone-300 truncate max-w-[80px]">{item.brand}</span>
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Footer: hint + price */}
                          <div className="flex justify-between items-center pt-2 border-t border-[#2a2a2a] mt-2">
                            <span className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">Tap for details</span>
                            <span className="text-[12px] font-black text-white bg-[#4b41e1]/20 border border-[#4b41e1]/30 px-2.5 py-0.5 rounded-lg font-mono">
                              ₹{outfit.totalPrice.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── Dot Indicators */}
                <div className="flex justify-center gap-2 py-2">
                  {outfits.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveIndex(i); playBeep(520, "sine", 0.03); }}
                      aria-label={`View outfit ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === activeIndex ? "w-5 bg-black" : "w-1.5 bg-stone-300"
                      }`}
                    />
                  ))}
                </div>

                <div className="text-center text-[8.5px] text-stone-400 font-bold uppercase tracking-wider pb-1">
                  Swipe to switch · Tap to shop
                </div>

                {/* ── Share toast */}
                <AnimatePresence>
                  {showCopiedBadge && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="bg-black text-white text-[9px] font-bold text-center py-2.5 rounded-xl my-1 uppercase tracking-wide"
                    >
                      ✓ Fit link copied · Share with friends
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

          </AnimatePresence>

          {/* ── DETAIL DRAWER ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {selectedOutfitDetail && (
              <motion.div
                key="detail-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 z-30 flex flex-col justify-end"
                onClick={() => { setSelectedOutfitDetail(null); playBeep(350, "sine", 0.05); }}
              >
                <motion.div
                  key="detail-drawer"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 250 }}
                  className="bg-white rounded-t-[28px] max-h-[92%] flex flex-col shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Sticky handle + header inside the drawer */}
                  <div className="sticky top-0 bg-white rounded-t-[28px] z-10 pt-3 pb-0 border-b border-stone-100">
                    <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-3" />
                    <div className="flex justify-between items-center px-5 pb-3">
                      <span className="text-[8px] bg-amber-50 text-amber-800 font-extrabold uppercase tracking-widest px-2.5 py-1 border border-amber-200 rounded">
                        {selectedOutfitDetail.tag || "Elite Concept"}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setSelectedOutfitDetail(null); playBeep(350, "sine", 0.06); }}
                        className="flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-lg hover:bg-stone-100 transition-all"
                      >
                        Close <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable body */}
                  <div className="overflow-y-auto no-scrollbar flex-1 px-5 pt-3 pb-6">
                    {/* Look name + description */}
                    <h4 className="font-display text-[15px] font-extrabold text-black tracking-tight mb-1">
                      {selectedOutfitDetail.lookName}
                    </h4>
                    <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                      {selectedOutfitDetail.description}
                    </p>

                    {/* Total price bar */}
                    <div className="flex justify-between items-center p-3 bg-stone-50 border border-stone-200/60 rounded-xl mb-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                        Total Price
                      </span>
                      <span className="font-mono font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-100 text-[12px]">
                        ₹{selectedOutfitDetail.totalPrice.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                      {selectedOutfitDetail.items.map((item, itemIdx) => {
                        const imgKey  = `${selectedOutfitDetail.id}-${itemIdx}`;
                        const seed    = strSeed(item.brand, item.name, item.type);
                        const imgUrl  = getItemImageUrl(item, seed);
                        const isBroken = !!brokenImgs[imgKey];
                        const badgeStyle = PLATFORM_STYLE[item.platform] ?? PLATFORM_STYLE.Myntra;
                        const platformLabel = item.platform ? item.platform.toUpperCase() : "STORE";

                        return (
                          <div
                            key={itemIdx}
                            className="bg-white border border-stone-150 rounded-2xl overflow-hidden shadow-sm"
                          >
                            {/* Image + info row */}
                            <div className="flex">
                              {/* Product image */}
                              <div
                                className="shrink-0 relative overflow-hidden bg-stone-100"
                                style={{ width: 88, minHeight: 108 }}
                              >
                                {!isBroken ? (
                                  <img
                                    src={imgUrl}
                                    alt={`${item.type} — ${item.name}`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={() => markImgBroken(imgKey)}
                                    loading="lazy"
                                  />
                                ) : (
                                  /* Gradient fallback */
                                  <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                      background: `linear-gradient(145deg, ${item.colorHex}dd 0%, ${item.colorHex}44 100%)`,
                                    }}
                                  >
                                    <span
                                      className="material-symbols-outlined text-white/80"
                                      style={{ fontSize: 30, fontVariationSettings: "'FILL' 1" }}
                                    >
                                      {TYPE_ICON[item.type] ?? "checkroom"}
                                    </span>
                                  </div>
                                )}
                                {/* Color swatch dot overlay */}
                                <div
                                  className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full border-2 border-white shadow"
                                  style={{ backgroundColor: item.colorHex || "#aaa" }}
                                />
                              </div>

                              {/* Item info */}
                              <div className="flex-1 p-3 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-stone-400">
                                    {item.type}
                                  </span>
                                  <span className={`text-[7.5px] font-black px-1.5 py-0.5 border rounded uppercase tracking-wide ${badgeStyle}`}>
                                    {platformLabel}
                                  </span>
                                </div>
                                <h5 className="font-bold text-[12px] text-black leading-snug mb-1 line-clamp-2">
                                  {item.name}
                                </h5>
                                <p className="text-[10px] text-stone-500">
                                  {item.brand}
                                  {" · "}
                                  <strong className="text-black font-black">
                                    ₹{item.price.toLocaleString("en-IN")}
                                  </strong>
                                </p>
                              </div>
                            </div>

                            {/* Style tip + Buy row */}
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-stone-100 bg-stone-50">
                              <span className="text-[9px] text-amber-700/80 italic leading-tight truncate">
                                ✦ {item.styleAdvice}
                              </span>
                              <a
                                id={`buy-btn-${selectedOutfitDetail.id}-${itemIdx}`}
                                href={getBuyLink(item)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  playBeep(920, "sine", 0.05);
                                  if (selectedOutfitDetail) trackItemBuyClick(item, selectedOutfitDetail.lookName, item.platform || "Unknown");
                                }}
                                className="shrink-0 flex items-center gap-1 bg-black text-white text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-all uppercase tracking-wide"
                              >
                                Buy <ShoppingBag className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Close CTA */}
                    <button
                      type="button"
                      onClick={() => { setSelectedOutfitDetail(null); playBeep(400, "sine", 0.06); }}
                      className="w-full mt-5 bg-black text-white rounded-xl py-4 text-[11px] font-black hover:bg-stone-900 transition-all uppercase tracking-widest"
                    >
                      Keep Viewing Fits
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>{/* end pages container */}
      </main>
    </div>
  );
}
