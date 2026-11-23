import type { RolePermissionMatrix } from '../types';

export const HEADER_IDENTITAS_SYNC = 'X-AMS-Sync-Identity';

export function buatIdentitasSinkronisasi(
  userId: string,
  roleId: string,
  permissions: RolePermissionMatrix,
  employeeId?: string
): string {
  const permissionsTerurut = Object.fromEntries(
    Object.entries(permissions)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([resource, actions]) => [resource, [...actions].sort()])
  );
  return JSON.stringify([userId, roleId, permissionsTerurut, employeeId || null]);
}
