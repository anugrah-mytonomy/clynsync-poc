import { beforeEach, describe, expect, it } from 'vitest';
import authReducer, { clearToken, setToken } from '@/feature/auth/authSlice';

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts unauthenticated with no token', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state).toEqual({ token: null, isAuthenticated: false });
  });

  it('sets the token and marks the user authenticated', () => {
    const state = authReducer(undefined, setToken('abc123'));
    expect(state).toEqual({ token: 'abc123', isAuthenticated: true });
    expect(localStorage.getItem('auth_token')).toBe('abc123');
  });

  it('clears the token and marks the user unauthenticated', () => {
    const authenticated = authReducer(undefined, setToken('abc123'));
    const state = authReducer(authenticated, clearToken());
    expect(state).toEqual({ token: null, isAuthenticated: false });
    expect(localStorage.getItem('auth_token')).toBeNull();
  });
});
