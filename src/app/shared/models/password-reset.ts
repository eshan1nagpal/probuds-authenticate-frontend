export const RESET_OUTCOMES = [
  'RESET_REQUEST_ACCEPTED', 'RESET_LINK_INVALID', 'RESET_RATE_LIMITED', 'RESET_UNAVAILABLE',
  'PASSWORD_CHANGED', 'PASSWORD_REUSED', 'INVALID_PASSWORD',
] as const;
export type PasswordResetOutcome = typeof RESET_OUTCOMES[number];
export interface PasswordResetResponse { status: boolean; outcome: PasswordResetOutcome; }
export interface PasswordResetConfirmation { token: string; newPassword: string; confirmPassword: string; }
