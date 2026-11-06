import React from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
  icon?: IconName;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon = 'cal' }) => {
  return (
    <div className="state state--inline" data-testid="empty-state">
      <h2>
        <Icon name={icon} />
        {title}
      </h2>
      {description && <p className="sub">{description}</p>}
      {action &&
        (action.href ? (
          <Link to={action.href} className="btn-big">
            {action.label}
          </Link>
        ) : (
          <button type="button" className="btn-big" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
};
