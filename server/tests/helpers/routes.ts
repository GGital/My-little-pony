/**
 * The Sprint 1 route table (SDS §6.3), used by TEST-SR2-03 to call every route with GET.
 * Each Issue that adds an endpoint adds its row here in the same PR; I-12 checks that all twelve are listed.
 */
export type RouteRow = { id: string; method: 'GET' | 'POST'; path: string }

export const SPRINT1_ROUTES: RouteRow[] = [{ id: 'E-12', method: 'GET', path: '/api/health' }]
