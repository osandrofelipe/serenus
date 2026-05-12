import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Adiciona token JWT automaticamente
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Renova token automaticamente se expirado
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach(prom => error ? prom.reject(error) : prom.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = res.data;
        Cookies.set('accessToken', accessToken, { expires: 7, secure: true, sameSite: 'strict' });
        Cookies.set('refreshToken', newRefresh, { expires: 30, secure: true, sameSite: 'strict' });
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token: string) => api.get(`/auth/verify-email/${token}`),
};

// Professionals
export const prosAPI = {
  list: (params?: any) => api.get('/professionals', { params }),
  get: (id: string) => api.get(`/professionals/${id}`),
  updateMe: (data: any) => api.put('/professionals/me', data),
  getAvailability: (id: string, date: string) => api.get(`/professionals/${id}/availability`, { params: { date } }),
  updateAvailability: (data: any) => api.put('/professionals/me/availability', data),
  // Admin
  getPending: () => api.get('/professionals/admin/pending'),
  approve: (id: string) => api.post(`/professionals/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/professionals/${id}/reject`, { reason }),
};

// Bookings
export const bookingsAPI = {
  create: (data: any) => api.post('/bookings', data),
  list: (params?: any) => api.get('/bookings', { params }),
  get: (id: string) => api.get(`/bookings/${id}`),
  confirm: (id: string) => api.patch(`/bookings/${id}/confirm`),
  complete: (id: string) => api.patch(`/bookings/${id}/complete`),
  cancel: (id: string, reason?: string) => api.patch(`/bookings/${id}/cancel`, { reason }),
};

// Reviews
export const reviewsAPI = {
  create: (data: any) => api.post('/reviews', data),
  reply: (id: string, reply: string) => api.put(`/reviews/${id}/reply`, { reply }),
};

// Services
export const servicesAPI = {
  create: (data: any) => api.post('/services', data),
  update: (id: string, data: any) => api.put(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
};

// Admin
export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  users: (params?: any) => api.get('/admin/users', { params }),
  bookings: (params?: any) => api.get('/admin/bookings', { params }),
  reviews: () => api.get('/admin/reviews'),
  auditLog: () => api.get('/admin/audit-log'),
  suspendUser: (id: string) => api.patch(`/admin/users/${id}/suspend`),
  activateUser: (id: string) => api.patch(`/admin/users/${id}/activate`),
};

// Notifications
export const notificationsAPI = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
};

export default api;
