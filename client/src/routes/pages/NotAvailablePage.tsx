import React from 'react';

export const NotAvailablePage: React.FC = () => {
  return (
    <div className="container py-5 text-center" data-testid="not-available-page">
      <h2>Not Available</h2>
      <p>This page isn't available for your account</p>
    </div>
  );
};
