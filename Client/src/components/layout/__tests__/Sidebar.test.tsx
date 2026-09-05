import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/testing/testUtils';
import Sidebar from '@/components/layout/Sidebar';

describe('Sidebar', () => {
  it('marks the current route as active and others as inactive', () => {
    renderWithProviders(<Sidebar />, { route: '/dashboard/poc-5' });

    expect(screen.getByRole('link', { name: /poc 5/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('renders all primary nav links and the signed-in user', () => {
    renderWithProviders(<Sidebar />, { route: '/dashboard' });

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /poc 5/i })).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('clinic-lead@mytonomy.com')).toBeInTheDocument();
  });
});
