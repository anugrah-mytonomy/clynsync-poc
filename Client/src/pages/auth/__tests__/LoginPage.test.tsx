import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { setupStore } from '@/app/store';
import LoginPage from '@/pages/auth/LoginPage';

function renderLoginPage() {
  const store = setupStore();

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Clinical Governance Overview</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

  return { store };
}

describe('LoginPage', () => {
  it('navigates to the dashboard once credentials pass validation', async () => {
    const user = userEvent.setup();
    const { store } = renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'clinic-lead@mytonomy.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Clinical Governance Overview')).toBeInTheDocument();
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it('shows validation errors and does not navigate for invalid input', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.queryByText('Clinical Governance Overview')).not.toBeInTheDocument();
  });
});
