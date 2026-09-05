import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import ProtectedRoute from '@/routes/ProtectedRoute';
import DashboardLayout from '@/layouts/DashboardLayout';
import PageLoader from '@/components/ui/PageLoader';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const Poc5Page = lazy(() => import('@/pages/poc5/Poc5Page'));
// const ContentLibraryPage = lazy(() => import('@/pages/content-library/ContentLibraryPage'));
// const ScansPage = lazy(() => import('@/pages/dashboard/ScansPage'));
// const FindingsReportsPage = lazy(() => import('@/pages/dashboard/FindingsReportsPage'));
// const ReviewQueuePage = lazy(() => import('@/pages/dashboard/ReviewQueuePage'));
// const HelpSupportPage = lazy(() => import('@/pages/dashboard/HelpSupportPage'));
// const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'));

const withSuspense = (element: RouteObject['element']) => {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
};

const dashboardRoutes: RouteObject[] = [
  {
    path: '/dashboard',
    element: withSuspense(<DashboardPage />),
  },
  {
    path: '/dashboard/poc-5',
    element: withSuspense(<Poc5Page />),
  },
  // {
  //   path: '/dashboard/content-library',
  //   element: withSuspense(<ContentLibraryPage />),
  // },
  // {
  //   path: '/dashboard/scans',
  //   element: withSuspense(<ScansPage />),
  // },
  // {
  //   path: '/dashboard/findings-reports',
  //   element: withSuspense(<FindingsReportsPage />),
  // },
  // {
  //   path: '/dashboard/review-queue',
  //   element: withSuspense(<ReviewQueuePage />),
  // },
  // {
  //   path: '/dashboard/help',
  //   element: withSuspense(<HelpSupportPage />),
  // },
  // {
  //   path: '/dashboard/settings',
  //   element: withSuspense(<SettingsPage />),
  // },
];

export const privateRoutes: RouteObject[] = [
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: dashboardRoutes,
      },
    ],
  },
];
