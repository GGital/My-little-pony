import React from 'react';
import type { UserRole } from '../api/types';

export interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  return <>{children}</>;
};

export interface RequireRoleProps {
  role: UserRole;
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ children }) => {
  return <>{children}</>;
};
