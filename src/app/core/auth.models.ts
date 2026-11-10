export const LOGIN_OUTCOMES = [
  'AUTHENTICATED', 'PASSWORD_CHANGE_REQUIRED', 'ACCOUNT_EXPIRED',
  'PASSWORD_EXPIRY_CONFIGURATION_INVALID', 'ACCOUNT_LOCKED', 'ACCOUNT_DISABLED',
  'CREDENTIALS_EXPIRED', 'INVALID_CREDENTIALS', 'PASSWORD_CHANGED',
  'INVALID_PASSWORD', 'PASSWORD_REUSED',
] as const;

export type LoginOutcome = typeof LOGIN_OUTCOMES[number];

export interface AuthenticationResponse {
  status: boolean | null;
  accessToken?: string | null;
  expiresIn?: number | null;
  validFor?: string | null;
  username?: string | null;
  name?: string | null;
  roles?: string[] | null;
  outcome?: LoginOutcome | null;
  passwordExpiryDate?: string | null;
  passwordExpiresInDays?: number | null;
}

export interface CurrentUser {
  username: string;
  name: string;
  roles: string[];
}

export interface Notice {
  tone: 'error' | 'warning' | 'success' | 'info';
  message: string;
}

export interface PasswordChangeRequest {
  newPassword: string;
  confirmPassword: string;
}
