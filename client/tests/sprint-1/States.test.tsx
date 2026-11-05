import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Loading } from '../../src/components/Loading';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FormFieldError } from '../../src/components/FormFieldError';
import { SubmitButton } from '../../src/components/SubmitButton';
import type { ApiErrorDetail } from '../../src/api/types';

describe('Shared UI States (TEST-C-05)', () => {
  it('renders loading state with aria-busy and status role', () => {
    render(<Loading label="Loading events..." />);
    const loadingEl = screen.getByRole('status');
    expect(loadingEl).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });

  it('renders named empty state with primary next action', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No events scheduled yet"
        description="Check back later or explore another format."
        action={{ label: 'Explore Formats', onClick: onAction }}
      />
    );

    expect(screen.getByText('No events scheduled yet')).toBeInTheDocument();
    expect(screen.getByText('Check back later or explore another format.')).toBeInTheDocument();

    const actionButton = screen.getByRole('button', { name: 'Explore Formats' });
    expect(actionButton).toBeInTheDocument();
    fireEvent.click(actionButton);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders error state with server message and Try again button that retries', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        message="Unable to reach the server. Please check your connection."
        onRetry={onRetry}
      />
    );

    expect(
      screen.getByText('Unable to reach the server. Please check your connection.')
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Try again/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders field errors under matching form inputs and sets submit button aria-busy', () => {
    const details: ApiErrorDetail[] = [
      { field: 'capacity', message: 'Capacity must be between 1 and 256' },
      { field: 'title', message: 'Title is required' },
    ];

    const isSubmitting = true;

    render(
      <form>
        <div>
          <label htmlFor="title-input">Title</label>
          <input id="title-input" name="title" defaultValue="" />
          <FormFieldError field="title" details={details} />
        </div>

        <div>
          <label htmlFor="capacity-input">Capacity</label>
          <input id="capacity-input" name="capacity" defaultValue="999" />
          <FormFieldError field="capacity" details={details} />
        </div>

        <SubmitButton busy={isSubmitting} busyLabel="Saving...">
          Submit
        </SubmitButton>
      </form>
    );

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Capacity must be between 1 and 256')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Saving...' });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveAttribute('aria-busy', 'true');
  });
});
