export type UserRole = 'PARTICIPANT' | 'ORGANIZER';

export interface AuthUser {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
}

/** Feature-U (Sprint 2 CH-11): the trading card game of an event or a store. Shown by name only (X-14). */
export type Game = 'POKEMON' | 'MAGIC' | 'ONE_PIECE' | 'YUGIOH' | 'DIGIMON' | 'LORCANA' | 'OTHER';

/** A store's public contact details, null per empty field (D-37). Never the sign-in email. */
export interface StoreContact {
  phone: string | null;
  email: string | null;
  website: string | null;
  line: string | null;
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
  /** Sprint 2 Feature-M: the EFFECTIVE deadline (the stored one, or startAt). Optional so older fixtures still compile. */
  registrationDeadline?: string;
  /** Feature-U. Optional so older fixtures still compile. */
  game?: Game;
  store?: { displayName: string; logoUrl: string | null; games?: Game[]; contact?: StoreContact };
}

export interface EventDetail extends EventSummary {
  venueAddress: string;
  structureNote: string;
  contact: string;
  description: string;
  organizer: {
    displayName: string;
  };
  /** Public on a cancelled event, null otherwise (E-05). Always sent by the server; optional so older fixtures still type-check. */
  cancelReason?: string | null;
  cancelledAt?: string | null;
  hasStarted: boolean;
  viewer: {
    action: ViewerAction;
    registrationId: number | null;
    canCancel?: boolean;
  };
}

/** One row of an event's change history, E-17 (Sprint 2 contracts §0.1, SR-08). Only the display name, never an id. */
export interface EventChange {
  id: number;
  field: 'status' | 'details' | 'capacity' | 'deadline';
  oldValue: string | null;
  newValue: string;
  changedAt: string;
  changedBy: { displayName: string };
}

export interface ParticipantRegistration {
  id: number;
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED' | 'EVENT_CANCELLED';
  createdAt: string;
  /** Set when status is CANCELLED or EVENT_CANCELLED (Sprint 2 Feature-N). */
  cancelledAt?: string | null;
  /** The server decides whether the player may cancel now (Feature-N). */
  canCancel?: boolean;
  event: EventSummary;
}

export interface OrganizerRegistrationRow {
  id: number;
  participant: {
    displayName: string;
  };
  status: 'REGISTERED' | 'CHECKED_IN' | 'CANCELLED';
  createdAt: string;
  cancelledAt?: string | null;
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

export interface EventSearchMeta {
  page: number;
  pageSize: number;
  totalItems: number;
}

/** E-04 response (Feature-J). */
export interface EventSearchResponse {
  items: EventSummary[];
  meta: EventSearchMeta;
}
