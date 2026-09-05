import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { setupStore, type AppStore } from '@/app/store';

interface RenderOptions {
  route?: string;
  store?: AppStore;
}

export const renderWithProviders = (
  ui: ReactElement,
  { route = '/', store = setupStore() }: RenderOptions = {},
) => {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  };

  return { store, ...render(ui, { wrapper: Wrapper }) };
};

export * from '@testing-library/react';
