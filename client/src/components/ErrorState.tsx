import React from 'react';
import { Icon } from './Icon';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="state state--error" data-testid="error-state" role="alert">
      <h2>
        <Icon name="alert" />
        We couldn't load this page
      </h2>
      <p className="sub">{message}</p>
      {onRetry && (
        <button type="button" className="btn-big btn-big--outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
};
