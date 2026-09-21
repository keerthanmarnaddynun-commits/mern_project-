const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/admin`;

export const adminApi = {
  getHeaders: () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async getOverview() {
    const response = await fetch(`${API_URL}/overview`, {
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch overview');
    return data;
  },

  async getClaims() {
    const response = await fetch(`${API_URL}/claims`, {
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch claims');
    return data;
  },

  async approveClaim(claimId: string) {
    const response = await fetch(`${API_URL}/claims/${claimId}/approve`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to approve claim');
    return data;
  },

  async rejectClaim(claimId: string) {
    const response = await fetch(`${API_URL}/claims/${claimId}/reject`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to reject claim');
    return data;
  },

  async getItems() {
    const response = await fetch(`${API_URL}/items`, {
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch items');
    return data;
  },

  async closeDispute(itemId: string) {
    const response = await fetch(`${API_URL}/items/${itemId}/close-dispute`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to close dispute');
    return data;
  },

  async getActivity() {
    const response = await fetch(`${API_URL}/activity`, {
      headers: this.getHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch activity');
    return data;
  },
};

export const closeDispute = (itemId: string) => adminApi.closeDispute(itemId);

