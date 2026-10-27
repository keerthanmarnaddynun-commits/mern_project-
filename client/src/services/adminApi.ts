import { getCsrfTokenFromCookie } from './api';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin`;

export const adminApi = {
  getHeaders: () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    return headers;
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async logout() {
    const rootApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const response = await fetch(`${rootApiUrl}/auth/logout`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    return response.ok;
  },

  async getOverview() {
    const response = await fetch(`${API_URL}/overview`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch overview');
    return data;
  },

  async getClaims() {
    const response = await fetch(`${API_URL}/claims`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch claims');
    return data;
  },

  async approveClaim(claimId: string) {
    const response = await fetch(`${API_URL}/claims/${claimId}/approve`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to approve claim');
    return data;
  },

  async rejectClaim(claimId: string) {
    const response = await fetch(`${API_URL}/claims/${claimId}/reject`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to reject claim');
    return data;
  },

  async getItems() {
    const response = await fetch(`${API_URL}/items`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch items');
    return data;
  },

  async closeDispute(itemId: string) {
    const response = await fetch(`${API_URL}/items/${itemId}/close-dispute`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to close dispute');
    return data;
  },

  async handoverItem(itemId: string, payload?: { challengerId?: string; recipientId?: string; verificationMethod?: string; verificationNotes?: string }) {
    const response = await fetch(`${API_URL}/items/${itemId}/handover`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload || {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to handover item');
    return data;
  },

  async getActivity() {
    const response = await fetch(`${API_URL}/activity`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch activity');
    return data;
  },
};

export const closeDispute = (itemId: string) => adminApi.closeDispute(itemId);
