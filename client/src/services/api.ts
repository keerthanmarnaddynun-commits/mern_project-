import axios from 'axios';
import type { Item, SimilarItemsResponse } from '../types';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
}

export async function createItem(item: CreateItemPayload): Promise<Item> {
  const response = await API.post('/items', item);
  return response.data;
}

export async function markResolved(id: string): Promise<void> {
  await API.patch(`/items/${id}`, { status: 'resolved' });
}

export async function deleteItem(id: string): Promise<void> {
  await API.delete(`/items/${id}`);
}
