export type UserRole = 'PARTICIPANT' | 'ORGANIZER';

export interface AuthUser {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
}

export type ViewerAction =
  | 'MANAGE'
  | 'ORGANIZER_CANNOT_REGISTER'
  | 'REGISTERED'
  | 'CLOSED'
  | 'FULL'
  | 'SIGN_IN_TO_REGISTER'
  | 'REGISTER';

export interface EventSummary {
  id: number;
  title: string;
  type: string;
  format: string;
  venueName: string;
  city: string;
  startAt: string;
  endAt: string;
  feeLabel: string;
  capacity: number;
  registeredCount: number;
  seatsRemaining: number;
  status: 'PUBLISHED' | 'DRAFT' | 'CANCELLED';
}

export interface EventDetail extends EventSummary {
  venueAddress: string;
  structureNote: string;
  contact: string;
  description: string;
  organizer: {
    displayName: string;
  };
  hasStarted: boolean;
  viewer: {
    action: ViewerAction;
    registrationId: number | null;
  };
}

export interface ParticipantRegistration {
  id: number;
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED';
  createdAt: string;
  event: EventSummary;
}

export interface OrganizerRegistrationRow {
  id: number;
  participant: {
    displayName: string;
  };
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED';
  createdAt: string;
}

export interface EventRegistrationsResponse {
  event: {
    id: number;
    title: string;
    capacity: number;
    registeredCount: number;
    seatsRemaining: number;
  };
  items: OrganizerRegistrationRow[];
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorEnvelope {
  error: ApiErrorPayload;
}
