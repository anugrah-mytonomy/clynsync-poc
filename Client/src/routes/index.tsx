import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { publicRoutes } from '@/routes/public.routes';
import { privateRoutes } from '@/routes/private.routes';

const devPlaygroundRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/playground',
        lazy: () =>
          import('@/playground').then((module) => ({
            Component: module.Playground,
          })),
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  ...publicRoutes,
  ...privateRoutes,
  ...devPlaygroundRoutes,
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
