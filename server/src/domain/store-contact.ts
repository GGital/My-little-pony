// Store profile rules (Feature-U, Sprint 2 contracts §11.1). Stub for the red commit: S2-09 implements it.
export type StoreProfileError = { field: string; message: string }
export type StoreProfileData = {
  games?: string[]
  contactPhone?: string | null
  contactEmail?: string | null
  contactWebsite?: string | null
  contactLine?: string | null
}
export type StoreProfileResult = { ok: true; data: StoreProfileData } | { ok: false; errors: StoreProfileError[] }

export function validateStoreProfile(_body: unknown): StoreProfileResult {
  throw new Error('validateStoreProfile is not implemented (S2-09)')
}
