/**
 * The Sprint 1 route table (SDS §6.3), used by TEST-SR2-03 to call every route with GET.
 * Each Issue that adds an endpoint adds its row here in the same PR; I-12 checks that all twelve are listed.
 */
export type RouteRow = { id: string; method: 'GET' | 'POST'; path: string }

export const SPRINT1_ROUTES: RouteRow[] = [
  { id: 'E-01', method: 'POST', path: '/api/auth/login' },
  { id: 'E-02', method: 'POST', path: '/api/auth/logout' },
  { id: 'E-03', method: 'GET', path: '/api/auth/me' },
  { id: 'E-04', method: 'GET', path: '/api/events' },
  { id: 'E-05', method: 'GET', path: '/api/events/1' },
  { id: 'E-06', method: 'POST', path: '/api/events' },
  { id: 'E-07', method: 'GET', path: '/api/organizer/events' },
  { id: 'E-09', method: 'POST', path: '/api/events/1/registrations' },
  { id: 'E-10', method: 'GET', path: '/api/me/registrations' },
  { id: 'E-11', method: 'GET', path: '/api/me/registrations/1' },
  { id: 'E-12', method: 'GET', path: '/api/health' },
]
