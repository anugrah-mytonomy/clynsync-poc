import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const AUTH_TOKEN_KEY = 'auth_token';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
}

const readStoredAuth = (): AuthState => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    token,
    isAuthenticated: Boolean(token),
  };
};

const initialState: AuthState = readStoredAuth();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.isAuthenticated = true;
      localStorage.setItem(AUTH_TOKEN_KEY, action.payload);
    },
    clearToken: (state) => {
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem(AUTH_TOKEN_KEY);
    },
  },
});

export const { setToken, clearToken } = authSlice.actions;
export default authSlice.reducer;
