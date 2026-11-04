import React from 'react';

export interface LoadingProps {
  label?: string;
}

export const Loading: React.FC<LoadingProps> = ({ label = 'Loading...' }) => {
  return (
    <div data-testid="loading-state" role="status" aria-busy="true">
      <span>{label}</span>
    </div>
  );
};
