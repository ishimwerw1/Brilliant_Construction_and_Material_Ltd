import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://backend-576f.onrender.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bcml_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginPath = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/login');

    if (error.response?.status === 401 && !isLoginPath) {
      localStorage.removeItem('bcml_token');
      localStorage.removeItem('bcml_user');

      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const getError = (err) =>
  err?.response?.data?.message || err?.message || 'Something went wrong';

export default api;