import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';

/** 403 page (design-direction §4.3): explains, shows none of the hidden record, offers a way back. */
export const NotAvailablePage: React.FC = () => {
  return (
    <div className="state" data-testid="not-available-page">
      <h1>
        <Icon name="lock" />
        This page isn't available for your account
      </h1>
      <p className="sub">This page belongs to a different kind of account. Nothing from it was loaded.</p>
      <Link to="/events" className="btn-big">
        BACK TO FIND AN EVENT
      </Link>
    </div>
  );
};
