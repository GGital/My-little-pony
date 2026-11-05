import React from 'react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="container py-5 text-center" data-testid="not-found-page">
      <h2>Not Found</h2>
      <p>The page you requested could not be found.</p>
    </div>
  );
};
