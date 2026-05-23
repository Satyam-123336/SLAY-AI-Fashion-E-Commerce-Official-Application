import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart, Share2, ShoppingBag, RotateCw, SlidersHorizontal } from "lucide-react";
import { Gender, Occasion, Accessory, SlayOutfit, SlayItem } from "./types";
import Onboarding from "./Onboarding";

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

/** Returns a reliable fashion image URL — uses AI-provided URL, then loremflickr fallback */
function getItemImageUrl(item: SlayItem, seed: number): string {
  if (item.imageUrl && item.imageUrl.startsWith("http")) return item.imageUrl;
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
    const t = setTimeout(() => setShowSplash(false), 2600);
    return () => clearTimeout(t);
  }, []);

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
  const handleCurate = async () => {
    setScreen("curating");
    setErrorMessage(null);
    playBeep(520, "sine", 0.1);

    try {
      const response = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gender, age, occasion, accessories: selectedAccessories, budget }),
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

      setOutfits(data.outfits);
      setActiveIndex(0);
      setBrokenImgs({});
      setSelectedOutfitDetail(null);
      setScreen("results");
      playBeep(880, "sine", 0.15);
    } catch (err: any) {
      console.error("Curation error:", err);
      setErrorMessage(err.message || "Something went wrong. Tap to try again.");
      setScreen("onboarding");
    }
  };

  const toggleAccessory = (acc: Accessory) => {
    playBeep(450, "sine", 0.04);
    setSelectedAccessories((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  const toggleSaveOutfit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    playBeep(680, "sine", 0.05);
    setSavedOutfitIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleShare = (e: React.MouseEvent, outfit: SlayOutfit) => {
    e.stopPropagation();
    playBeep(720, "sine", 0.05);
    const text = `Check this SLAY AI fit: "${outfit.lookName}" — Total ₹${outfit.totalPrice.toLocaleString("en-IN")}. Curate yours!`;
    navigator.clipboard.writeText(text).catch(() => {});
    setShowCopiedBadge(true);
    setTimeout(() => setShowCopiedBadge(false), 2200);
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
            onClick={() => { setMenuOpen(true); playBeep(400, "sine", 0.04); }}
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
                    Think of me as your personal digital stylist. I'll put together 3 fits in 30 seconds — all within your budget.
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
                        { icon: "shopping_bag",   text: "Buy directly from Myntra, Ajio & Meesho" },
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
                        { name: "Ajio",   cls: "text-stone-800 bg-stone-50 border-stone-200" },
                        { name: "Meesho", cls: "text-pink-600 bg-pink-50 border-pink-100" },
                      ].map((p) => (
                        <span
                          key={p.name}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${p.cls}`}
                        >
                          {p.name}
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

                <h4 className="font-display text-[14px] font-black text-black uppercase tracking-tight mb-2">
                  Curating Your Lookbook
                </h4>
                <p className="text-[10px] text-stone-400 tracking-widest font-mono uppercase mb-8">
                  Myntra · Ajio · Meesho
                </p>

                {/* Step indicators */}
                <div className="w-full max-w-[220px] space-y-3">
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
                    onClick={handleCurate}
                    aria-label="Regenerate outfits"
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
                <div className="relative flex-1 w-full flex items-center justify-center" style={{ minHeight: 272 }}>
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
                            setSelectedOutfitDetail(outfit);
                            playBeep(780, "sine", 0.08);
                          } else {
                            setActiveIndex(index);
                            playBeep(520, "sine", 0.05);
                          }
                        }}
                        className="absolute bg-[#1c1b1b] rounded-2xl border border-[#2a2a2a] p-4 flex flex-col justify-between cursor-pointer select-none overflow-hidden shadow-2xl"
                        style={{ width: "92%", height: 268 }}
                      >
                        {/* Top row: tag + actions */}
                        <div>
                          <div className="flex justify-between items-start mb-2.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#4b41e1] bg-[#4b41e1]/8 px-2.5 py-1 rounded">
                              {outfit.tag || "SLAY PICK"}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={(e) => toggleSaveOutfit(e, outfit.id)}
                                aria-label={isSaved ? "Unsave outfit" : "Save outfit"}
                                className="p-1.5 rounded-full hover:bg-stone-100 transition-colors"
                              >
                                <Heart className={`h-3 w-3 ${isSaved ? "text-[#4b41e1] fill-[#4b41e1]" : "text-stone-400"}`} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleShare(e, outfit)}
                                aria-label="Share outfit"
                                className="p-1.5 rounded-full hover:bg-stone-100 transition-colors text-stone-400"
                              >
                                <Share2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Look name */}
                          <h4 className="font-display text-[13px] font-extrabold tracking-tight text-white line-clamp-1 mb-2">
                            {outfit.lookName}
                          </h4>

                          {/* Color palette strip — shows the outfit's color story */}
                          <div className="flex gap-1.5 mb-2.5">
                            {outfit.items.map((item, ci) => (
                              <div
                                key={ci}
                                title={`${item.type}: ${item.colorHex}`}
                                className="h-[5px] flex-1 rounded-full"
                                style={{ backgroundColor: item.colorHex || "#e5e2e1" }}
                              />
                            ))}
                          </div>

                          {/* Item list */}
                          <div className="bg-[#252424] rounded-xl border border-[#333] divide-y divide-[#333] overflow-hidden">
                            {outfit.items.slice(0, 3).map((item, ii) => (
                              <div key={ii} className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full border border-[#252424] shadow-sm shrink-0"
                                    style={{ backgroundColor: item.colorHex || "#ccc" }}
                                  />
                                  <span className="text-[8px] font-black uppercase text-stone-400 tracking-wide">
                                    {item.type}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold text-stone-300 truncate text-right">
                                  {item.brand} · {item.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card footer */}
                        <div className="flex justify-between items-center pt-2 border-t border-[#333]">
                          <span className="text-[8px] font-bold text-stone-500 uppercase tracking-widest">
                            Tap for details
                          </span>
                          <span className="text-[11px] font-black text-white bg-[#333] px-2.5 py-0.5 rounded-lg font-mono">
                            ₹{outfit.totalPrice.toLocaleString("en-IN")}
                          </span>
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
                        const platformLabel = PLATFORM_LABEL[item.platform] ?? "STORE";

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
                                onClick={() => playBeep(920, "sine", 0.05)}
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
