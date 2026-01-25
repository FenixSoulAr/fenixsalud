// Admin email allowlist - case-insensitive matching
// This is checked client-side for UI gating only.
// All admin actions are validated server-side in the admin-actions edge function.

export const ADMIN_EMAILS = [
  "jorge.perez.ar@gmail.com",
  "leandro.perez.ar@gmail.com",
  "agustina.laterza@gmail.com",
] as const;

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
  );
}
