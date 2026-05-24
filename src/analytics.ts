/**
 * SLAY AI - Comprehensive GA4 Analytics Module
 * Tracks every meaningful user interaction for fashion e-commerce growth intelligence.
 *
 * Event taxonomy follows GA4 + Google's enhanced e-commerce schema so that:
 *  - Google Analytics 4 reports are populated automatically
 *  - BigQuery export gives full raw event data for ML/expansion use
 *  - Funnel visualisation works out of the box in GA4 Explorations
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/** Fire a GA4 event safely (no-op if gtag not loaded) */
function gtagEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. APP LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

/** Fired once when the splash screen is shown (first app load) */
export function trackAppOpen() {
  gtagEvent("app_open", {
    event_category: "lifecycle",
    event_label: "slay_ai_launch",
  });
}

/** Fired when splash screen dismisses and onboarding appears */
export function trackOnboardingStart() {
  gtagEvent("tutorial_begin", {
    event_category: "onboarding",
    event_label: "preferences_screen_shown",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ONBOARDING / PREFERENCE SELECTION
// ─────────────────────────────────────────────────────────────────────────────

/** Fired when user changes gender preference */
export function trackGenderSelect(gender: string) {
  gtagEvent("select_content", {
    content_type: "gender_preference",
    item_id: gender,
    event_category: "onboarding",
    event_label: gender,
  });
}

/** Fired when user changes age */
export function trackAgeSelect(age: number) {
  const ageGroup =
    age < 18 ? "under_18" :
    age < 22 ? "18_21" :
    age < 26 ? "22_25" :
    age < 30 ? "26_29" :
    age < 35 ? "30_34" : "35_plus";

  gtagEvent("select_content", {
    content_type: "age_preference",
    item_id: ageGroup,
    age_exact: age,
    event_category: "onboarding",
    event_label: `age_${age}`,
  });
}

/** Fired when user picks an occasion */
export function trackOccasionSelect(occasion: string) {
  gtagEvent("select_content", {
    content_type: "occasion",
    item_id: occasion.replace(/\s+/g, "_").toLowerCase(),
    event_category: "onboarding",
    event_label: occasion,
  });
}

/** Fired when user toggles an accessory on or off */
export function trackAccessoryToggle(accessory: string, selected: boolean) {
  gtagEvent("select_content", {
    content_type: "accessory",
    item_id: accessory.replace(/\s+/g, "_").toLowerCase(),
    action: selected ? "add" : "remove",
    event_category: "onboarding",
    event_label: `${selected ? "add" : "remove"}_${accessory}`,
  });
}

/** Fired when user changes budget slider (debounce this on the caller side) */
export function trackBudgetSet(budget: number) {
  const bucket =
    budget <= 600  ? "under_600" :
    budget <= 1000 ? "600_1000" :
    budget <= 1500 ? "1000_1500" :
    budget <= 2000 ? "1500_2000" :
    budget <= 2500 ? "2000_2500" : "2500_plus";

  gtagEvent("select_content", {
    content_type: "budget",
    item_id: bucket,
    budget_exact: budget,
    currency: "INR",
    event_category: "onboarding",
    event_label: `budget_${budget}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. OUTFIT GENERATION (FUNNEL CRITICAL)
// ─────────────────────────────────────────────────────────────────────────────

/** Fired when user taps "SLAY MY LOOK" — curate request begins */
export function trackCurateStart(params: {
  gender: string;
  age: number;
  occasion: string;
  accessories: string[];
  budget: number;
}) {
  gtagEvent("generate_lead", {
    event_category: "curate",
    event_label: "curate_started",
    gender: params.gender,
    age: params.age,
    occasion: params.occasion.replace(/\s+/g, "_").toLowerCase(),
    accessories: params.accessories.join(","),
    budget: params.budget,
    currency: "INR",
  });

  // Also fire as a standard search event (populates GA4 site-search reports)
  gtagEvent("search", {
    search_term: `${params.occasion} ${params.gender} ₹${params.budget}`,
  });
}

/** Fired when outfits are successfully returned from the AI */
export function trackCurateSuccess(params: {
  outfitCount: number;
  totalItems: number;
  occasion: string;
  budget: number;
  durationMs: number;
}) {
  gtagEvent("curate_success", {
    event_category: "curate",
    event_label: "outfits_generated",
    outfit_count: params.outfitCount,
    total_items: params.totalItems,
    occasion: params.occasion.replace(/\s+/g, "_").toLowerCase(),
    budget: params.budget,
    api_latency_ms: params.durationMs,
    currency: "INR",
  });
}

/** Fired when outfit generation fails */
export function trackCurateError(errorMessage: string, occasion: string, budget: number) {
  gtagEvent("curate_error", {
    event_category: "curate",
    event_label: "generation_failed",
    error_message: errorMessage.slice(0, 100),
    occasion: occasion.replace(/\s+/g, "_").toLowerCase(),
    budget,
    currency: "INR",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. OUTFIT CARD INTERACTIONS (GA4 E-COMMERCE)
// ─────────────────────────────────────────────────────────────────────────────

/** GA4 item object from a SlayOutfit */
function outfitToGAItem(outfit: {
  id: string;
  lookName: string;
  tag?: string;
  totalPrice: number;
  items: Array<{ name: string; brand: string; type: string; price: number; colorHex?: string }>;
}, index: number) {
  return {
    item_id: outfit.id,
    item_name: outfit.lookName,
    item_category: outfit.tag ?? "SLAY PICK",
    price: outfit.totalPrice,
    currency: "INR",
    index,
    // Custom fashion dimensions
    item_brand: outfit.items.map(i => i.brand).join(", "),
    item_variant: outfit.items.map(i => i.colorHex ?? "").join(","),
  };
}

/** Fired when outfit results screen loads — impression tracking */
export function trackOutfitListView(outfits: Array<{
  id: string; lookName: string; tag?: string; totalPrice: number;
  items: Array<{ name: string; brand: string; type: string; price: number; colorHex?: string }>;
}>, occasion: string) {
  gtagEvent("view_item_list", {
    item_list_id: `occasion_${occasion.replace(/\s+/g, "_").toLowerCase()}`,
    item_list_name: occasion,
    items: outfits.map((o, i) => outfitToGAItem(o, i)),
  });
}

/** Fired when user swipes to / views a specific outfit card */
export function trackOutfitCardView(outfit: {
  id: string; lookName: string; tag?: string; totalPrice: number;
  items: Array<{ name: string; brand: string; type: string; price: number; colorHex?: string }>;
}, index: number) {
  gtagEvent("select_item", {
    item_list_id: "outfit_results",
    item_list_name: "Your Lookbooks",
    items: [outfitToGAItem(outfit, index)],
  });
}

/** Fired when user taps a card to open the full detail drawer */
export function trackOutfitDetailOpen(outfit: {
  id: string; lookName: string; tag?: string; totalPrice: number;
  items: Array<{ name: string; brand: string; type: string; price: number; colorHex?: string }>;
}, index: number) {
  gtagEvent("view_item", {
    currency: "INR",
    value: outfit.totalPrice,
    items: [outfitToGAItem(outfit, index)],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ITEM-LEVEL INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Fired when user taps "Buy" on a specific item inside a card */
export function trackItemBuyClick(item: {
  name: string; brand: string; type: string; price: number; platform?: string;
}, outfitName: string, platform: string) {
  // GA4 e-commerce begin_checkout
  gtagEvent("begin_checkout", {
    currency: "INR",
    value: item.price,
    items: [{
      item_id: `${item.brand}_${item.name}`.replace(/\s+/g, "_").toLowerCase(),
      item_name: item.name,
      item_brand: item.brand,
      item_category: item.type,
      price: item.price,
      currency: "INR",
    }],
    outfit_name: outfitName,
    platform,
  });

  // Also track as a platform-specific event
  gtagEvent("platform_click", {
    event_category: "purchase_intent",
    event_label: platform,
    platform,
    item_brand: item.brand,
    item_type: item.type,
    item_price: item.price,
    outfit_name: outfitName,
    currency: "INR",
    value: item.price,
  });
}

/** Fired when user clicks "Shop Full Outfit" CTA */
export function trackShopFullOutfit(outfit: {
  id: string; lookName: string; totalPrice: number;
  items: Array<{ name: string; brand: string; type: string; price: number }>;
}, platform: string) {
  gtagEvent("begin_checkout", {
    currency: "INR",
    value: outfit.totalPrice,
    items: outfit.items.map((it, i) => ({
      item_id: `${it.brand}_${it.name}`.replace(/\s+/g, "_").toLowerCase(),
      item_name: it.name,
      item_brand: it.brand,
      item_category: it.type,
      price: it.price,
      index: i,
      currency: "INR",
    })),
    outfit_name: outfit.lookName,
    platform,
    checkout_type: "full_outfit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SHARING
// ─────────────────────────────────────────────────────────────────────────────

/** Fired when share button is tapped */
export function trackShareStart(outfitName: string, totalPrice: number) {
  gtagEvent("share", {
    method: "slay_ai_share_card",
    content_type: "outfit",
    item_id: outfitName.replace(/\s+/g, "_").toLowerCase(),
    event_category: "sharing",
    event_label: outfitName,
    outfit_price: totalPrice,
    currency: "INR",
  });
}

/** Fired when native share sheet opened successfully */
export function trackShareSuccess(method: "native_share" | "clipboard", outfitName: string) {
  gtagEvent("share_success", {
    event_category: "sharing",
    event_label: method,
    method,
    content_type: "outfit",
    item_id: outfitName.replace(/\s+/g, "_").toLowerCase(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. NAVIGATION & UI
// ─────────────────────────────────────────────────────────────────────────────

/** Fired when hamburger menu is opened */
export function trackMenuOpen() {
  gtagEvent("menu_open", {
    event_category: "navigation",
    event_label: "hamburger_menu",
  });
}

/** Fired when "Restyle" / re-curate is triggered from results screen */
export function trackRestyle() {
  gtagEvent("restyle", {
    event_category: "navigation",
    event_label: "restyle_clicked",
  });
}

/** Fired when user scrolls through outfit cards (each card view) */
export function trackCarouselSwipe(fromIndex: number, toIndex: number) {
  gtagEvent("scroll_outfit", {
    event_category: "engagement",
    event_label: `card_${toIndex}`,
    from_index: fromIndex,
    to_index: toIndex,
  });
}

/** Generic page_view override for SPA screens */
export function trackScreenView(screenName: "onboarding" | "curating" | "results") {
  gtagEvent("page_view", {
    page_title: `SLAY AI - ${screenName}`,
    page_location: window.location.href,
    screen_name: screenName,
  });
}

/** Fired when sound is toggled on/off */
export function trackSoundToggle(muted: boolean) {
  gtagEvent("sound_toggle", {
    event_category: "settings",
    event_label: muted ? "muted" : "unmuted",
    muted,
  });
}
