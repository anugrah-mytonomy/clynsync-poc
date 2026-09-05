import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import PageLoader from '@/components/ui/PageLoader';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));

export const publicRoutes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <AuthLayout>
          <LoginPage />
        </AuthLayout>
      </Suspense>
    ),
  },
  {
    path: '/portal',
    element: <Navigate to="/dashboard" replace />,
  },
];
