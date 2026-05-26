export type Gender = "Men" | "Women" | "Unisex";

export type Occasion =
  | "Everyday & College"
  | "Office & Work Mode"
  | "Fusion Wear"
  | "Cafe & Weekend Hangout"
  | "Wedding Guest & Mehendi Night"
  | "Festive & Ethnic"
  | "Gym & Athleisure"
  | "Vacation & Travel";

export type Accessory =
  | "Footwear"
  | "Bags & Clutches"
  | "Jewellery"
  | "Sunglasses"
  | "Perfumes"
  | "Watches";

export interface OnboardingData {
  gender: Gender;
  age: number;
  occasion: Occasion;
  accessories: Accessory[];
  budget: number;
}

export interface SlayItem {
  type: string; // "Topwear" | "Bottomwear" | "Footwear" | "Accessory"
  name: string;
  brand: string;
  price: number;
  platform: string;
  searchQuery: string;
  productUrl: string;
  colorHex: string;
  styleAdvice: string;
  imageUrl?: string; // Optional product image URL from AI or fallback
}

export interface SlayOutfit {
  id: string;
  lookName: string;
  description: string;
  tag: string;
  totalPrice: number;
  items: SlayItem[];
}
