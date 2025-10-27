export const SUPERUSER_EMAIL = 'michael@mysight.net';

export function isSuperuserEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === SUPERUSER_EMAIL;
}
