import React from 'react';

export const AppShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      <header data-testid="app-header">Header Stub</header>
      <main>{children}</main>
    </div>
  );
};
