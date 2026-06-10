import { apiFetch } from './api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'OWNER' | 'CASHIER';
  createdAt?: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function logout() {
  return apiFetch<null>('/auth/logout', { method: 'POST' });
}

export function getMe() {
  return apiFetch<{ user: User }>('/auth/me');
}
