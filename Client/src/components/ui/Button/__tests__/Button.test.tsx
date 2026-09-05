import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Button from '@/components/ui/Button';

describe('Button', () => {
  it('renders children and responds to clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button while loading', () => {
    render(<Button isLoading>Save</Button>);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('applies full width styling when fullWidth is set', () => {
    render(<Button fullWidth>Sign In</Button>);

    expect(screen.getByRole('button', { name: 'Sign In' })).toHaveClass('w-full');
  });

  it('supports the ghost variant and size overrides', () => {
    render(
      <Button variant="ghost" size="lg">
        Cancel
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button).toHaveClass('bg-transparent');
    expect(button).toHaveClass('text-base');
  });
});
