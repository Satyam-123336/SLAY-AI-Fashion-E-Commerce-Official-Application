import React from "react";
import { Gender, Occasion, Accessory } from "./types";
import { trackGenderSelect, trackAgeSelect, trackOccasionSelect, trackBudgetSet } from "./analytics";

type Props = {
  gender: Gender;
  setGender: (g: Gender) => void;
  age: number;
  setAge: (n: number) => void;
  occasion: Occasion;
  setOccasion: (o: Occasion) => void;
  selectedAccessories: Accessory[];
  toggleAccessory: (a: Accessory) => void;
  budget: number;
  setBudget: (n: number) => void;
  handleCurate: () => void;
  errorMessage: string | null;
};

const accessoryConfig: { key: Accessory; icon: string; label: string }[] = [
  { key: "Footwear",      icon: "steps",          label: "Footwear"       },
  { key: "Bags & Clutches", icon: "shopping_bag",  label: "Bags & Clutches" },
  { key: "Jewellery",     icon: "diamond",         label: "Jewellery"      },
  { key: "Sunglasses",    icon: "eyeglasses",      label: "Sunglasses"     },
  { key: "Perfumes",      icon: "local_florist",   label: "Perfumes"       },
  { key: "Watches",       icon: "watch",           label: "Watches"        },
];

const occasionsList: { value: Occasion; label: string; icon: string; sub: string }[] = [
  { value: "Everyday & College",            icon: "checkroom",         label: "Everyday",      sub: "& College"         },
  { value: "Office & Work Mode",            icon: "work",              label: "Office",        sub: "& Work Mode"       },
  { value: "Fusion Wear",                   icon: "auto_awesome",      label: "Fusion Wear",   sub: "For Women"         },
  { value: "Cafe & Weekend Hangout",        icon: "local_cafe",        label: "Cafe",          sub: "& Weekend Hangout" },
  { value: "Wedding Guest & Mehendi Night", icon: "favorite",          label: "Wedding Guest", sub: "& Mehendi Night"   },
  { value: "Festive & Ethnic",              icon: "celebration",       label: "Festive",       sub: "& Ethnic"          },
  { value: "Gym & Athleisure",              icon: "fitness_center",    label: "Gym",           sub: "& Athleisure"      },
  { value: "Vacation & Travel",             icon: "flight",            label: "Vacation",      sub: "& Travel"          },
];

export default function Onboarding(props: Props) {
  const {
    gender, setGender,
    age, setAge,
    occasion, setOccasion,
    selectedAccessories, toggleAccessory,
    budget, setBudget,
    handleCurate,
    errorMessage,
  } = props;

  const formatBudget = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    /* Scrollable content + sticky CTA footer — fills flex-1 parent */
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* ── Scrollable form content ── */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-44">

        {/* Intro heading */}
        <section className="px-6 pt-8 pb-4">
          <h2 className="font-display text-[32px] md:text-[40px] font-black tracking-tight text-primary leading-tight">
            Preference Builder
          </h2>
          <p className="text-[#444748] mt-2 text-[16px] font-semibold">
            3 fits. 30 seconds. In your budget.
          </p>
        </section>

        {/* ── Silhouette ── */}
        <section className="px-6 py-6 border-b border-outline-variant/10">
          <label className="font-label-sm text-[12px] font-semibold uppercase tracking-widest text-[#444748] mb-4 block">
            Silhouette
          </label>
          <div className="flex gap-2" role="radiogroup" aria-label="Silhouette">
            {(["Women", "Men", "Unisex"] as Gender[]).map((g) => {
              const active = gender === g;
              return (
                <button
                  key={g}
                  onClick={() => {
                    setGender(g);
                    trackGenderSelect(g);
                  }}
                  aria-pressed={active}
                  aria-label={`Select ${g}`}
                  className={`flex-1 py-3 px-4 rounded-full border font-bold text-[12px] tracking-widest uppercase transition-all active:scale-[0.98] ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-surface text-[#444748] border-[#c4c7c7] hover:border-[#747878]"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Target Age ── */}
        <section className="px-6 py-8 border-b border-outline-variant/10">
          <div className="flex justify-between items-center mb-6">
            <label className="font-label-sm text-[12px] font-semibold uppercase tracking-widest text-[#444748]">
              Target Age
            </label>
            <span className="text-[24px] font-bold text-[#4b41e1] leading-none">
              {age}
            </span>
          </div>
          <div className="relative px-2">
            <input
              className="custom-range custom-range-accent w-full h-[2px] bg-[#e5e2e1] rounded-lg appearance-none cursor-pointer"
              type="range"
              min={15}
              max={55}
              value={age}
              onChange={(e) => setAge(parseInt(e.target.value))}
              onPointerUp={() => trackAgeSelect(age)}
            />
            <div className="flex justify-between mt-4 text-[10px] text-[#747878] font-bold tracking-tighter">
              <span>15 YEARS</span>
              <span>55 YEARS</span>
            </div>
          </div>
        </section>

        {/* ── Occasion ── */}
        <section className="px-6 py-8 border-b border-outline-variant/10">
          <label className="font-label-sm text-[12px] font-semibold uppercase tracking-widest text-[#444748] mb-4 block">
            Occasion
          </label>
          <div className="grid grid-cols-2 gap-3">
            {occasionsList.map(({ value, icon, label, sub }) => {
              const active = occasion === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    setOccasion(value as Occasion);
                    trackOccasionSelect(value);
                  }}
                  aria-pressed={active}
                  className={`accessory-tile relative p-4 border rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.98] group ${
                    active
                      ? "border-[#4b41e1] bg-[#645efb]/10 ring-1 ring-[#4b41e1]"
                      : "border-[#c4c7c7] hover:bg-[#f7f3f2]"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined transition-colors ${
                      active ? "text-[#4b41e1]" : "text-[#747878] group-hover:text-primary"
                    }`}
                    style={active ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'FILL' 0" }}
                  >
                    {icon}
                  </span>
                  <span className={`text-[12px] font-semibold uppercase tracking-widest transition-colors ${
                    active ? "text-[#4b41e1] font-bold" : "text-[#444748] group-hover:text-[#1c1b1b]"
                  }`}>
                    {label}
                  </span>
                  <span className={`text-[10px] tracking-wide transition-colors ${
                    active ? "text-[#4b41e1]/70" : "text-[#a0a3a3]"
                  }`}>
                    {sub}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Accessories ── */}
        <section className="px-6 py-8 border-b border-outline-variant/10">
          <label className="font-label-sm text-[12px] font-semibold uppercase tracking-widest text-[#444748] mb-6 block">
            Accessories
          </label>
          <div className="grid grid-cols-2 gap-3">
            {accessoryConfig.map(({ key, icon, label }) => {
              const sel = selectedAccessories.includes(key);
              return (
                <div
                  key={key}
                  onClick={() => toggleAccessory(key)}
                  role="button"
                  aria-pressed={sel}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAccessory(key);
                    }
                  }}
                  className={`accessory-tile p-4 border rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all active:scale-[0.98] group ${
                    sel
                      ? "border-[#4b41e1] bg-[#645efb]/10 ring-1 ring-[#4b41e1]"
                      : "border-[#c4c7c7] hover:bg-[#f7f3f2]"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined transition-colors ${
                      sel ? "text-[#4b41e1]" : "text-[#747878] group-hover:text-primary"
                    }`}
                    style={sel ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'FILL' 0" }}
                  >
                    {icon}
                  </span>
                  <span
                    className={`text-[12px] font-semibold uppercase tracking-widest transition-colors ${
                      sel ? "text-[#4b41e1] font-bold" : "text-[#444748] group-hover:text-[#1c1b1b]"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Max Budget ── */}
        <section className="px-6 py-8">
          <div className="flex justify-between items-center mb-6">
            <label className="font-label-sm text-[12px] font-semibold uppercase tracking-widest text-[#444748]">
              Max Budget
            </label>
            <span className="text-[24px] font-bold text-primary leading-none">
              {formatBudget(budget)}
            </span>
          </div>
          <div className="relative px-2">
            <input
              className="custom-range w-full h-[2px] bg-[#e5e2e1] rounded-lg appearance-none cursor-pointer accent-black"
              type="range"
              min={300}
              max={3000}
              step={100}
              value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              onPointerUp={() => trackBudgetSet(budget)}
            />
            <div className="flex justify-between mt-4 text-[10px] text-[#747878] font-bold tracking-tighter">
              <span>₹300</span>
              <span>₹3,000</span>
            </div>
          </div>
        </section>

      </div>

      {/* ── Sticky Footer CTA ── */}
      <div className="absolute bottom-0 left-0 w-full p-6 bg-surface/90 backdrop-blur-lg border-t border-outline-variant/30">
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-3 p-2 bg-red-50 text-red-700 text-[12px] font-bold rounded-lg border border-red-100 text-center"
          >
            {errorMessage}
          </div>
        )}
        <button
          onClick={handleCurate}
          className="w-full bg-primary text-white py-5 rounded-lg text-[24px] font-bold tracking-tighter active:scale-[0.98] hover:bg-[#4b41e1] transition-colors duration-300 shadow-lg leading-none mb-4"
        >
          Curate My Look
        </button>
        <p className="text-[11px] font-bold text-stone-400 text-center tracking-widest uppercase">
          © 2026 FLASHFUSION LABS PRIVATE LIMITED
        </p>
      </div>
    </div>
  );
}
