
export enum MarketingMedium {
  MUG = 'Coffee Mug',
  TSHIRT = 'T-Shirt',
  BILLBOARD = 'City Billboard',
  PHONE_CASE = 'Phone Case',
  TOTE_BAG = 'Tote Bag',
  POSTER = 'Street Poster',
  TRUCK = 'Delivery Truck'
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface GeneratedImage {
  id: string;
  medium: MarketingMedium;
  url: string;
  timestamp: number;
  aspectRatio: AspectRatio;
}

export interface Preset {
  id: string;
  name: string;
  mediums: MarketingMedium[];
  aspectRatio: AspectRatio;
  advancedConfig: {
    temperature: number;
    topK: number;
    topP: number;
    seed?: number;
  };
}

export interface AppState {
  sourceImage: string | null;
  selectedMediums: MarketingMedium[];
  generatedImages: GeneratedImage[];
  isGenerating: boolean;
  error: string | null;
  selectedAspectRatio: AspectRatio;
}
