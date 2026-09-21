import { ADMIN_ROLES, ALL_PERMISSIONS, PERMISSION } from '@/constants/api-endpoints';

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Khớp DEFAULT_ROLE_PERMISSIONS trên API — dùng để giải thích form, không thay GET /auth/me. */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly string[]> = {
  data_entry: [
    PERMISSION.EMPLOYEE_READ,
    PERMISSION.EMPLOYEE_UPDATE,
    PERMISSION.WALLET_READ,
    PERMISSION.WALLET_WRITE,
    PERMISSION.WALLET_VERIFY,
    PERMISSION.IMPORT_CREATE,
    PERMISSION.IMPORT_READ,
    PERMISSION.IMPORT_VALIDATE,
    PERMISSION.IMPORT_SUBMIT,
    PERMISSION.ATTENDANCE_READ,
    PERMISSION.ATTENDANCE_STAGING_UPDATE,
    PERMISSION.PENALTY_READ,
    PERMISSION.PENALTY_STAGING_UPDATE,
    PERMISSION.PAYROLL_READ,
    PERMISSION.PAYROLL_STAGING_UPDATE,
  ],
  approver: [
    PERMISSION.EMPLOYEE_READ,
    PERMISSION.IMPORT_READ,
    PERMISSION.ATTENDANCE_READ,
    PERMISSION.PENALTY_READ,
    PERMISSION.PAYROLL_READ,
    PERMISSION.DATA_APPROVE,
    PERMISSION.DATA_PUBLISH,
    PERMISSION.DATA_UNPUBLISH,
    PERMISSION.DATA_LOCK,
    PERMISSION.NOTIFICATION_DISPATCH,
  ],
  publisher: [
    PERMISSION.IMPORT_READ,
    PERMISSION.ATTENDANCE_READ,
    PERMISSION.PENALTY_READ,
    PERMISSION.PAYROLL_READ,
    PERMISSION.DATA_PUBLISH,
    PERMISSION.DATA_UNPUBLISH,
    PERMISSION.DATA_LOCK,
    PERMISSION.NOTIFICATION_DISPATCH,
  ],
  complaint_operator: [
    PERMISSION.EMPLOYEE_READ,
    PERMISSION.ATTENDANCE_READ,
    PERMISSION.PENALTY_READ,
    PERMISSION.PAYROLL_READ,
    PERMISSION.COMPLAINT_READ,
    PERMISSION.COMPLAINT_HANDLE,
    PERMISSION.WALLET_READ,
    PERMISSION.WALLET_VERIFY,
    PERMISSION.NOTIFICATION_READ,
  ],
  wallet_approver: [
    PERMISSION.EMPLOYEE_READ,
    PERMISSION.WALLET_READ,
    PERMISSION.WALLET_APPROVE,
    PERMISSION.WALLET_EXCEPTION_APPROVE,
  ],
  auditor: [PERMISSION.AUDIT_READ],
  system_admin: ALL_PERMISSIONS,
};

export const CONFLICTING_PERMISSION_PAIRS: readonly [string, string][] = [
  [PERMISSION.IMPORT_SUBMIT, PERMISSION.DATA_APPROVE],
  [PERMISSION.IMPORT_SUBMIT, PERMISSION.DATA_PUBLISH],
  [PERMISSION.ATTENDANCE_STAGING_UPDATE, PERMISSION.DATA_APPROVE],
  [PERMISSION.PENALTY_STAGING_UPDATE, PERMISSION.DATA_APPROVE],
  [PERMISSION.PAYROLL_STAGING_UPDATE, PERMISSION.DATA_APPROVE],
  [PERMISSION.VAULT_RECOVERY_REQUEST, PERMISSION.VAULT_RECOVERY_APPROVE],
  [PERMISSION.VAULT_DECRYPT_REQUEST, PERMISSION.VAULT_DECRYPT_APPROVE],
  [PERMISSION.WALLET_VERIFY, PERMISSION.WALLET_APPROVE],
  [PERMISSION.AUDIT_READ, PERMISSION.ROLE_MANAGE],
];

export const PERMISSION_GROUPS: { id: string; permissions: readonly string[] }[] = [
  {
    id: 'employee',
    permissions: [PERMISSION.EMPLOYEE_READ, PERMISSION.EMPLOYEE_WRITE, PERMISSION.EMPLOYEE_UPDATE],
  },
  {
    id: 'import',
    permissions: [
      PERMISSION.IMPORT_CREATE,
      PERMISSION.IMPORT_READ,
      PERMISSION.IMPORT_VALIDATE,
      PERMISSION.IMPORT_SUBMIT,
    ],
  },
  {
    id: 'records',
    permissions: [
      PERMISSION.ATTENDANCE_READ,
      PERMISSION.ATTENDANCE_STAGING_UPDATE,
      PERMISSION.PENALTY_READ,
      PERMISSION.PENALTY_STAGING_UPDATE,
      PERMISSION.PAYROLL_READ,
      PERMISSION.PAYROLL_STAGING_UPDATE,
    ],
  },
  {
    id: 'workflow',
    permissions: [
      PERMISSION.DATA_APPROVE,
      PERMISSION.DATA_PUBLISH,
      PERMISSION.DATA_UNPUBLISH,
      PERMISSION.DATA_LOCK,
    ],
  },
  {
    id: 'complaints',
    permissions: [PERMISSION.COMPLAINT_READ, PERMISSION.COMPLAINT_HANDLE],
  },
  {
    id: 'wallet',
    permissions: [
      PERMISSION.WALLET_READ,
      PERMISSION.WALLET_WRITE,
      PERMISSION.WALLET_VERIFY,
      PERMISSION.WALLET_APPROVE,
      PERMISSION.WALLET_EXCEPTION_APPROVE,
      PERMISSION.WALLET_LOCK_CONFIGURE,
    ],
  },
  {
    id: 'vault',
    permissions: [
      PERMISSION.VAULT_RECOVERY_REQUEST,
      PERMISSION.VAULT_RECOVERY_APPROVE,
      PERMISSION.VAULT_DECRYPT_REQUEST,
      PERMISSION.VAULT_DECRYPT_APPROVE,
    ],
  },
  {
    id: 'accounts',
    permissions: [
      PERMISSION.USER_READ,
      PERMISSION.USER_CREATE,
      PERMISSION.USER_UPDATE,
      PERMISSION.USER_DISABLE,
      PERMISSION.ROLE_MANAGE,
    ],
  },
  { id: 'audit', permissions: [PERMISSION.AUDIT_READ] },
  {
    id: 'notifications',
    permissions: [PERMISSION.NOTIFICATION_READ, PERMISSION.NOTIFICATION_DISPATCH],
  },
];

export function permissionI18nKey(code: string) {
  return code.replace(/:/g, '_');
}

export function permissionsFromRoles(roles: readonly string[]) {
  const granted = new Set<string>();
  for (const role of roles) {
    const list = ROLE_PERMISSIONS[role as AdminRole];
    if (!list) continue;
    for (const permission of list) granted.add(permission);
  }
  return granted;
}

export function findPermissionConflicts(permissions: Iterable<string>) {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return CONFLICTING_PERMISSION_PAIRS.filter(([left, right]) => set.has(left) && set.has(right));
}

export function extraPermissionChoices(
  roleGranted: Set<string>,
  catalog: readonly string[],
  alreadyAssigned: readonly string[],
): string[] {
  const visible = new Set([...catalog, ...alreadyAssigned]);
  const choices: string[] = [];
  for (const permission of ALL_PERMISSIONS) {
    if (visible.has(permission) && !roleGranted.has(permission)) choices.push(permission);
  }
  return choices;
}
