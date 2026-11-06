import React from 'react';
import { Icon } from './Icon';

export interface LoadingProps {
  label?: string;
  /** Number of skeleton cards to show under the label (list pages, design-direction §5). */
  cards?: number;
}

export const Loading: React.FC<LoadingProps> = ({ label = 'Loading…', cards = 0 }) => {
  return (
    <div data-testid="loading-state" role="status" aria-busy="true">
      <div className="loading">
        <Icon name="spin" spin />
        <span>{label}</span>
      </div>
      {cards > 0 && (
        <div className="stack" aria-hidden="true">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}
    </div>
  );
};
