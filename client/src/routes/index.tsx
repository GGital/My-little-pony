import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireRole } from './RouteGuards';
import { NotAvailablePage } from './pages/NotAvailablePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';
import { EventList } from '../pages/EventList';
import { EventDetail } from '../pages/EventDetail';
import { CreateEvent } from '../pages/organizer/CreateEvent';
const MyEventsStub = () => <div><h2>My Events</h2></div>;
const OrganizerDashboardStub = () => <div><h2>Organizer Dashboard</h2></div>;

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<EventList />} />
      <Route path="/events/:id" element={<EventDetail />} />
      <Route path="/login" element={<SignInPage />} />

      {/* Participant protected routes */}
      <Route
        path="/me/registrations"
        element={
          <RequireRole role="PARTICIPANT">
            <MyEventsStub />
          </RequireRole>
        }
      />

      {/* Organizer protected routes */}
      <Route
        path="/organizer"
        element={
          <RequireRole role="ORGANIZER">
            <OrganizerDashboardStub />
          </RequireRole>
        }
      />
      <Route
        path="/organizer/events/new"
        element={
          <RequireRole role="ORGANIZER">
            <CreateEvent />
          </RequireRole>
        }
      />

      {/* Fallback routes */}
      <Route path="/not-available" element={<NotAvailablePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
