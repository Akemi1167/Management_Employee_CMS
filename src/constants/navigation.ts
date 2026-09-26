import {
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileUp,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Lock,
  ScrollText,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { PERMISSION } from '@/constants/api-endpoints';

export interface NavItem {
  labelKey: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  match?: string;
  permission?: string;
  permissions?: readonly string[];
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    titleKey: 'nav.groups.overview',
    items: [{ labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard, end: true }],
  },
  {
    titleKey: 'nav.groups.employees',
    items: [
      {
        labelKey: 'nav.employees',
        to: '/employees',
        icon: Users,
        permission: PERMISSION.EMPLOYEE_READ,
      },
      {
        labelKey: 'nav.employeeSync',
        to: '/employee-sync',
        icon: Upload,
        permission: PERMISSION.EMPLOYEE_READ,
      },
      {
        labelKey: 'nav.walletImport',
        to: '/employees/wallets/import',
        icon: CreditCard,
        permission: PERMISSION.WALLET_WRITE,
      },
    ],
  },
  {
    titleKey: 'nav.groups.data',
    items: [
      {
        labelKey: 'nav.imports',
        to: '/imports',
        icon: FileUp,
        permission: PERMISSION.IMPORT_READ,
      },
      {
        labelKey: 'nav.importCreate',
        to: '/imports/create',
        icon: FileUp,
        end: true,
        permissions: [PERMISSION.IMPORT_CREATE, PERMISSION.IMPORT_READ],
      },
      {
        labelKey: 'nav.attendance',
        to: '/attendance',
        icon: CalendarCheck,
        permission: PERMISSION.ATTENDANCE_READ,
      },
      {
        labelKey: 'nav.penalties',
        to: '/penalties',
        icon: ClipboardList,
        permission: PERMISSION.PENALTY_READ,
      },
      {
        labelKey: 'nav.payroll',
        to: '/payroll',
        icon: Wallet,
        permission: PERMISSION.PAYROLL_READ,
      },
    ],
  },
  {
    titleKey: 'nav.groups.workflow',
    items: [
      {
        labelKey: 'nav.periodOverview',
        to: '/period-overview',
        icon: ListChecks,
        permission: PERMISSION.ATTENDANCE_READ,
      },
      {
        labelKey: 'nav.approvals',
        to: '/approvals',
        icon: ShieldCheck,
        permission: PERMISSION.DATA_APPROVE,
      },
      {
        labelKey: 'nav.publishing',
        to: '/publishing',
        icon: Lock,
        permissions: [PERMISSION.IMPORT_READ, PERMISSION.DATA_PUBLISH, PERMISSION.DATA_LOCK],
      },
      {
        labelKey: 'nav.complaints',
        to: '/complaints',
        icon: ClipboardList,
        permission: PERMISSION.COMPLAINT_READ,
      },
      {
        labelKey: 'nav.wallet',
        to: '/wallet',
        icon: CreditCard,
        permission: PERMISSION.WALLET_READ,
      },
      {
        labelKey: 'nav.vault',
        to: '/vault',
        icon: KeyRound,
        permissions: [
          PERMISSION.VAULT_RECOVERY_REQUEST,
          PERMISSION.VAULT_RECOVERY_APPROVE,
          PERMISSION.VAULT_DECRYPT_REQUEST,
          PERMISSION.VAULT_DECRYPT_APPROVE,
        ],
      },
    ],
  },
  {
    titleKey: 'nav.groups.admin',
    items: [
      {
        labelKey: 'nav.users',
        to: '/users',
        icon: Users,
        permission: PERMISSION.USER_READ,
      },
      {
        labelKey: 'nav.audit',
        to: '/audit',
        icon: ScrollText,
        permission: PERMISSION.AUDIT_READ,
      },
      {
        labelKey: 'nav.password',
        to: '/account/password',
        icon: KeyRound,
      },
    ],
  },
];

export const PATH_PERMISSIONS: Array<{ match: string; permission?: string; permissions?: string[] }> = [
  { match: '/', permission: undefined },
  { match: '/employees/wallets/import', permission: PERMISSION.WALLET_WRITE },
  { match: '/employees/import', permission: PERMISSION.EMPLOYEE_WRITE },
  { match: '/employees', permission: PERMISSION.EMPLOYEE_READ },
  { match: '/employee-sync', permission: PERMISSION.EMPLOYEE_READ },
  { match: '/imports/create', permissions: [PERMISSION.IMPORT_CREATE, PERMISSION.IMPORT_READ] },
  { match: '/imports', permission: PERMISSION.IMPORT_READ },
  { match: '/attendance', permission: PERMISSION.ATTENDANCE_READ },
  { match: '/penalties', permission: PERMISSION.PENALTY_READ },
  { match: '/payroll', permission: PERMISSION.PAYROLL_READ },
  { match: '/period-overview', permission: PERMISSION.ATTENDANCE_READ },
  { match: '/approvals', permission: PERMISSION.DATA_APPROVE },
  {
    match: '/publishing',
    permissions: [PERMISSION.IMPORT_READ, PERMISSION.DATA_PUBLISH, PERMISSION.DATA_LOCK],
  },
  { match: '/complaints', permission: PERMISSION.COMPLAINT_READ },
  { match: '/wallet', permission: PERMISSION.WALLET_READ },
  {
    match: '/vault',
    permissions: [
      PERMISSION.VAULT_RECOVERY_REQUEST,
      PERMISSION.VAULT_RECOVERY_APPROVE,
      PERMISSION.VAULT_DECRYPT_REQUEST,
      PERMISSION.VAULT_DECRYPT_APPROVE,
    ],
  },
  { match: '/users', permission: PERMISSION.USER_READ },
  { match: '/audit', permission: PERMISSION.AUDIT_READ },
  { match: '/account', permission: undefined },
];

export interface ApiModuleCard {
  id: string;
  labelKey: string;
  to: string | null;
  status: 'live' | 'planned';
  permission?: string;
  permissions?: readonly string[];
  rolesKey: string;
}

/** Catalog các API CMS đã mount và API mới chỉ có trong tài liệu. */
export const API_MODULES: ApiModuleCard[] = [
  {
    id: 'auth',
    labelKey: 'dashboard.modules.auth',
    to: '/account',
    status: 'live',
    rolesKey: 'dashboard.roles.any',
  },
  {
    id: 'employees',
    labelKey: 'nav.employees',
    to: '/employees',
    status: 'live',
    permission: PERMISSION.EMPLOYEE_READ,
    rolesKey: 'dashboard.roles.employees',
  },
  {
    id: 'employeeSync',
    labelKey: 'nav.employeeSync',
    to: '/employee-sync',
    status: 'live',
    permission: PERMISSION.EMPLOYEE_READ,
    rolesKey: 'dashboard.roles.employees',
  },
  {
    id: 'imports',
    labelKey: 'nav.imports',
    to: '/imports',
    status: 'live',
    permission: PERMISSION.IMPORT_READ,
    rolesKey: 'dashboard.roles.dataEntry',
  },
  {
    id: 'attendance',
    labelKey: 'nav.attendance',
    to: '/attendance',
    status: 'live',
    permission: PERMISSION.ATTENDANCE_READ,
    rolesKey: 'dashboard.roles.hrRead',
  },
  {
    id: 'penalties',
    labelKey: 'nav.penalties',
    to: '/penalties',
    status: 'live',
    permission: PERMISSION.PENALTY_READ,
    rolesKey: 'dashboard.roles.hrRead',
  },
  {
    id: 'payroll',
    labelKey: 'nav.payroll',
    to: '/payroll',
    status: 'live',
    permission: PERMISSION.PAYROLL_READ,
    rolesKey: 'dashboard.roles.hrRead',
  },
  {
    id: 'periodOverview',
    labelKey: 'nav.periodOverview',
    to: '/period-overview',
    status: 'live',
    permission: PERMISSION.ATTENDANCE_READ,
    rolesKey: 'dashboard.roles.hrRead',
  },
  {
    id: 'approvals',
    labelKey: 'nav.approvals',
    to: '/approvals',
    status: 'live',
    permission: PERMISSION.DATA_APPROVE,
    rolesKey: 'dashboard.roles.approver',
  },
  {
    id: 'publishing',
    labelKey: 'nav.publishing',
    to: '/publishing',
    status: 'live',
    permissions: [PERMISSION.IMPORT_READ, PERMISSION.DATA_PUBLISH, PERMISSION.DATA_LOCK],
    rolesKey: 'dashboard.roles.publisher',
  },
  {
    id: 'complaints',
    labelKey: 'nav.complaints',
    to: '/complaints',
    status: 'live',
    permission: PERMISSION.COMPLAINT_READ,
    rolesKey: 'dashboard.roles.complaint',
  },
  {
    id: 'users',
    labelKey: 'nav.users',
    to: '/users',
    status: 'live',
    permission: PERMISSION.USER_READ,
    rolesKey: 'dashboard.roles.admin',
  },
  {
    id: 'audit',
    labelKey: 'nav.audit',
    to: '/audit',
    status: 'live',
    permission: PERMISSION.AUDIT_READ,
    rolesKey: 'dashboard.roles.auditor',
  },
  {
    id: 'wallet',
    labelKey: 'dashboard.modules.wallet',
    to: '/wallet',
    status: 'live',
    permission: PERMISSION.WALLET_READ,
    rolesKey: 'dashboard.roles.wallet',
  },
  {
    id: 'vault',
    labelKey: 'dashboard.modules.vault',
    to: '/vault',
    status: 'live',
    permissions: [
      PERMISSION.VAULT_RECOVERY_REQUEST,
      PERMISSION.VAULT_RECOVERY_APPROVE,
      PERMISSION.VAULT_DECRYPT_REQUEST,
      PERMISSION.VAULT_DECRYPT_APPROVE,
    ],
    rolesKey: 'dashboard.roles.vault',
  },
];
