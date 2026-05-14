export type ItemType = 'lost' | 'found';
export type ItemStatus = 'pending' | 'resolved';

export interface Item {
  _id: string;
  title: string;
  description: string;
  category: string;
  type: ItemType;
  location: string;
  date_occurred: string;
  image_url?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  postedBy: string;
  status: ItemStatus;
  is_resolved?: boolean;
  createdAt: string;
}

export interface SimilarItemMatch {
  item: Item;
  score: number;
  reasons: string[];
}

export interface SimilarItemsResponse {
  currentItem: Item;
  matches: SimilarItemMatch[];
}

export interface User {
  _id: string;
  name: string;
  email: string;
}

export const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Accessories',
  'Documents',
  'Keys',
  'Wallet / Purse',
  'Bag / Backpack',
  'Jewelry',
  'Pets',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];
