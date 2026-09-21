import axios from 'axios';
import type { ClaimStatusResponse, Dispute, Item, SimilarItemsResponse, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const API = axios.create({ baseURL: API_BASE_URL });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;

export async function fetchItems(type?: 'lost' | 'found'): Promise<Item[]> {
  const params = type ? { status: type } : {};
  const response = await API.get('/items', { params });
  return Array.isArray(response.data) ? response.data : [];
}

export async function getMyReports(): Promise<Item[]> {
  const response = await API.get('/items/my-reports');
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchItemById(id: string): Promise<Item | null> {
  const response = await API.get(`/items/${id}`);
  return response.data || null;
}

export async function getSimilarItems(itemId: string): Promise<SimilarItemsResponse> {
  const response = await API.get<SimilarItemsResponse>(`/items/${itemId}/similar`);
  return response.data;
}

interface CreateItemPayload {
  title: string;
  description: string;
  category: string;
  type: 'lost' | 'found';
  location: string;
  date_occurred: string;
  image_url?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  custodyLocation?: string | null;
  custodyDepartment?: string | null;
  receiverName?: string | null;
  receiverRole?: string | null;
  handoverNotes?: string | null;
}

export async function createItem(item: CreateItemPayload): Promise<Item> {
  const response = await API.post('/items', item);
  return response.data;
}

export async function markResolved(id: string): Promise<void> {
  await API.patch(`/items/${id}`, { status: 'resolved' });
}

export async function updateItem(id: string, updates: Partial<CreateItemPayload>): Promise<Item> {
  const response = await API.patch(`/items/${id}`, updates);
  return response.data;
}

export async function deleteItem(id: string): Promise<void> {
  await API.delete(`/items/${id}`);
}

export async function createClaim(itemId: string): Promise<unknown> {
  const response = await API.post(`/claims/${itemId}`);
  return response.data;
}

export async function createManualClaim(
  itemId: string,
  data: { lostItemId: string; reasonType: string; reasonText?: string }
): Promise<unknown> {
  const response = await API.post(`/claims/manual/${itemId}`, data);
  return response.data;
}

export async function getClaimStatus(itemId: string): Promise<ClaimStatusResponse> {
  const response = await API.get<ClaimStatusResponse>(`/claims/item/${itemId}/status`);
  return response.data;
}

export async function getProfile(): Promise<User> {
  const response = await API.get<User>('/users/me');
  return response.data;
}

export async function updateProfile(data: { name?: string; email?: string }): Promise<User> {
  const response = await API.patch<User>('/users/me', data);
  return response.data;
}

export async function deleteAccount(): Promise<void> {
  await API.delete('/users/me');
}

export async function getCommunityInsights(): Promise<any> {
  const response = await API.get('/public/community-insights');
  return response.data;
}

export async function getReceivedClaims(): Promise<any[]> {
  const response = await API.get('/claims/received');
  return response.data;
}

export async function getMyClaims(): Promise<any[]> {
  const response = await API.get('/claims/my-claims');
  return response.data;
}

export const confirmItemReceipt = async (itemId: string) => {
  const { data } = await API.patch('/items/' + itemId + '/confirm-receipt');
  return data;
};

export const denyItemReceipt = async (itemId: string) => {
  const { data } = await API.patch('/items/' + itemId + '/deny-receipt');
  return data;
};

export const getDepartmentClaims = async () => {
  const { data } = await API.get('/claims/department');
  return data;
};

export const approveClaim = async (
  claimId: string,
  data: { verificationMethod: string; verificationNotes: string }
) => {
  const { data: res } = await API.patch(`/claims/${claimId}/approve`, data);
  return res;
};

export const facultyApproveClaim = approveClaim;

export const rejectClaim = async (
  claimId: string,
  payload?: { reason?: string; preventResubmit?: boolean }
) => {
  const { data } = await API.patch('/claims/' + claimId + '/reject', payload || {});
  return data;
};

export const resubmitClaim = async (
  claimId: string,
  payload: { lostItemId?: string; reasonType?: string; reasonText?: string }
) => {
  const { data } = await API.patch('/claims/' + claimId + '/resubmit', payload);
  return data;
};

export const getRecentlyReturned = async () => {
  const { data } = await API.get('/claims/recently-returned');
  return data;
};

export const disputeItemHandover = async (itemId: string, payload: { reason: string; proofUrl: string }) => {
  const { data } = await API.post('/items/' + itemId + '/dispute', payload);
  return data;
};

export const submitDispute = async (
  itemId: string,
  payload: { reason: string; proofUrl?: string }
) => {
  const { data } = await API.post('/disputes', { itemId, ...payload });
  return data;
};

export const getDisputes = async (): Promise<Dispute[]> => {
  const { data } = await API.get('/disputes');
  return Array.isArray(data) ? data : data?.disputes || [];
};

export const resolveDispute = async (
  id: string,
  payload: { action: 'approve' | 'reject'; adminNotes?: string }
) => {
  const { data } = await API.patch(`/disputes/${id}/resolve`, payload);
  return data;
};

export const confirmReturn = async (id: string) => {
  const { data } = await API.patch(`/disputes/${id}/recover`);
  return data;
};

export const getUserNotifications = async () => {
  const { data } = await API.get('/notifications');
  return Array.isArray(data) ? data : [];
};



