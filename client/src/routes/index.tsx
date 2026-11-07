import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireRole } from './RouteGuards';
import { NotAvailablePage } from './pages/NotAvailablePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';
import { EventList } from '../pages/EventList';
import { EventDetail } from '../pages/EventDetail';
import { MyEvents } from '../pages/MyEvents';
import { CreateEvent } from '../pages/organizer/CreateEvent';
import { Dashboard as OrganizerDashboard } from '../pages/organizer/Dashboard';
import { Registrations } from '../pages/organizer/Registrations';

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
            <MyEvents />
          </RequireRole>
        }
      />

      {/* Organizer protected routes */}
      <Route
        path="/organizer"
        element={
          <RequireRole role="ORGANIZER">
            <OrganizerDashboard />
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
      <Route
        path="/organizer/events/:id/registrations"
        element={
          <RequireRole role="ORGANIZER">
            <Registrations />
          </RequireRole>
        }
      />

      {/* Fallback routes */}
      <Route path="/not-available" element={<NotAvailablePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
