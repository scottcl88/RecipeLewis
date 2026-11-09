import type { Role } from './types';

export function roleFromClaims(claims: Record<string, unknown> | null | undefined): Role {
  if (!claims) return 'none';
  if (claims.admin === true) return 'admin';
  if (claims.member === true) return 'member';
  return 'none';
}
export const canWrite = (r: Role) => r === 'admin' || r === 'member';
export const isAdmin = (r: Role) => r === 'admin';
