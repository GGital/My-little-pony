import React from 'react';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => {
  return (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href}>{action.label}</a>
        ) : (
          <button type="button" onClick={action.onClick}>
            {action.label}
          </button>
        )
      )}
    </div>
  );
};
