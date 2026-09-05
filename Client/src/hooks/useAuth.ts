import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '@/app/store';
import { clearToken } from '@/feature/auth/authSlice';
import { useLogoutMutation } from '@/feature/auth/authApiSlice';

export function useAuth() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [logoutMutation, { isLoading: isLoggingOut }] = useLogoutMutation();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const token = useSelector((state: RootState) => state.auth.token);

  const logout = async () => {
    try {
      navigate('/login')
      await logoutMutation().unwrap();
    } finally {
      dispatch(clearToken());
      navigate('/login', { replace: true });
    }
  };

  return { isAuthenticated, token, logout, isLoggingOut };
}
