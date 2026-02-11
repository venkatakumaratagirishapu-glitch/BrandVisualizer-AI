
import React from 'react';
import { 
  Coffee, 
  Shirt, 
  Layout, 
  Smartphone, 
  ShoppingBag, 
  Image as ImageIcon, 
  Truck 
} from 'lucide-react';
import { MarketingMedium } from './types';

export const MEDIUM_METADATA = [
  { 
    id: MarketingMedium.MUG, 
    icon: <Coffee className="w-6 h-6" />, 
    description: 'A professional ceramic coffee mug in a cafe setting.' 
  },
  { 
    id: MarketingMedium.TSHIRT, 
    icon: <Shirt className="w-6 h-6" />, 
    description: 'A stylish cotton t-shirt worn by a model in a urban background.' 
  },
  { 
    id: MarketingMedium.BILLBOARD, 
    icon: <Layout className="w-6 h-6" />, 
    description: 'A large, brightly lit digital billboard in Times Square at dusk.' 
  },
  { 
    id: MarketingMedium.PHONE_CASE, 
    icon: <Smartphone className="w-6 h-6" />, 
    description: 'A sleek, modern phone case resting on a marble desk.' 
  },
  { 
    id: MarketingMedium.TOTE_BAG, 
    icon: <ShoppingBag className="w-6 h-6" />, 
    description: 'An eco-friendly canvas tote bag being carried in a sunny park.' 
  },
  { 
    id: MarketingMedium.POSTER, 
    icon: <ImageIcon className="w-6 h-6" />, 
    description: 'A minimalist poster on a textured concrete gallery wall.' 
  },
  { 
    id: MarketingMedium.TRUCK, 
    icon: <Truck className="w-6 h-6" />, 
    description: 'The side panel of a modern delivery truck driving on a highway.' 
  },
];
