export type ItemType = 'lost' | 'found';
export type ItemStatus = 'pending' | 'resolved';
export type CustodyStatus = 'not_handed_over' | 'department_received' | 'returned';

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
  custodyStatus?: CustodyStatus;
  custodyLocation?: string | null;
  custodyDepartment?: string | null;
  receiverName?: string | null;
  receiverRole?: string | null;
  handoverNotes?: string | null;
  handoverDate?: string | null;
  createdAt: string;
}

export interface SimilarItemMatch {
  item: Item;
  confidence: string;
  /** Present from API but not shown in UI */
  reasons?: string[];
}

export interface SimilarItemsResponse {
  currentItem: Item;
  matches: SimilarItemMatch[];
}

export interface ClaimStatusResponse {
  hasClaimed: boolean;
  claimStatus: 'pending' | 'approved' | 'rejected' | null;
  claimId: string | null;
  canClaim: boolean;
  reason: string | null;
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
