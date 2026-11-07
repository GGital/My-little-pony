import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';

/** 404 page: the same for a missing record and for one that belongs to someone else (D-08). */
export const NotFoundPage: React.FC = () => {
  return (
    <div className="state" data-testid="not-found-page">
      <h1>
        <Icon name="compass" />
        We couldn't find that page
      </h1>
      <p className="sub">The page you requested could not be found.</p>
      <Link to="/events" className="btn-big">
        BACK TO FIND AN EVENT
      </Link>
    </div>
  );
};
