// Single source of truth for "which version of the Terms/Privacy Policy is
// current" — shared between the legal pages themselves (display) and the
// consent-recording route (storage), so a bump here can never drift out of
// sync between what a user saw and what got recorded as accepted.
export const TERMS_VERSION = "2026-08-25";
export const TERMS_UPDATED_LABEL = "August 25, 2026";
