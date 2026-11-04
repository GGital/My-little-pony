import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth, RequireRole } from './RouteGuards';
import { NotAvailablePage } from './pages/NotAvailablePage';
import { NotFoundPage } from './pages/NotFoundPage';

// Placeholder route pages for Sprint 1 routing shell
const EventsStub = () => <div className="container py-4 text-white"><h2>Events</h2></div>;
const LoginStub = () => <div className="container py-4 text-white"><h2>Sign in</h2></div>;
const MyEventsStub = () => <div className="container py-4 text-white"><h2>My Events</h2></div>;
const OrganizerDashboardStub = () => <div className="container py-4 text-white"><h2>Organizer Dashboard</h2></div>;
const CreateEventStub = () => <div className="container py-4 text-white"><h2>Create Event</h2></div>;

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<EventsStub />} />
      <Route path="/login" element={<LoginStub />} />

      {/* Participant protected routes */}
      <Route
        path="/me/registrations"
        element={
          <RequireAuth>
            <MyEventsStub />
          </RequireAuth>
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
            <CreateEventStub />
          </RequireRole>
        }
      />

      {/* Fallback routes */}
      <Route path="/not-available" element={<NotAvailablePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
