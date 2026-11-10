export interface AdminFilters { username: string; name: string; }
export interface Page<T> { items: T[]; total: number; page: number; size: number; }
export interface RoleOption { id: string; name: string; }
export interface UserRow { username: string; name: string; email: string; roles: string[]; }
export interface UserDetail extends UserRow {
  version: number; enabled: boolean; accountNonLocked: boolean; accountNonExpired: boolean;
  credentialsNonExpired: boolean; willPasswordExpire: boolean; passwordExpiryDate: string | null;
  failedAttempts: number | null; createdAt: string; createdBy: string; updatedAt: string | null; updatedBy: string | null;
}
export interface CreateUser {
  username: string; name: string; email: string; password: string; confirmPassword: string;
  willPasswordExpire: boolean; expiryDays: number | null; roles: string[];
}
export interface UpdateUser {
  version: number; name: string; email: string; enabled: boolean; accountNonLocked: boolean;
  accountNonExpired: boolean; credentialsNonExpired: boolean; willPasswordExpire: boolean; expiryDays: number | null;
}
export interface HistoryRow { id: number; username: string; name: string | null; loginTime: string | null; }
