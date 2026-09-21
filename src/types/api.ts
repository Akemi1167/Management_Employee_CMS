export interface ApiErrorBody {
  statusCode: number;
  message?: string | string[];
  errors?: unknown;
  requestId?: string;
  timestamp?: string;
}

export interface Paginated<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface Listed<T> {
  total: number;
  items: T[];
}

export interface DataScope {
  allEmployees: boolean;
  departmentCodes: string[];
  employeeIds: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  extraPermissions: string[];
  permissions: string[];
  dataScope: DataScope;
  status: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  session?: {
    sessionId: string;
    mfaCompleted: boolean;
    stepUpAt: string | null;
  };
}

export interface MfaRequiredResult {
  status: 'MFA_REQUIRED';
  mfaToken: string;
  expiresIn: number;
}

export interface AuthenticatedResult {
  status: 'AUTHENTICATED';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
}

export type LoginResult = MfaRequiredResult | AuthenticatedResult;

export interface ImportTotals {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  totalAmount: string | null;
}

export interface ImportSessionFinding {
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  affectedCount: number;
  sampleEmployeeCodes: string[];
  rosterCount: number | null;
  coveredCount: number | null;
}

export interface ImportSessionListItem {
  id: string;
  code: string;
  dataType: DataType;
  period: string;
  status: WorkflowStatus;
  templateVersion: string;
  totals: ImportTotals;
  uploadedAt: string | null;
  submittedAt: string | null;
}

export interface ImportSessionDetail extends ImportSessionListItem {
  sessionFindings: ImportSessionFinding[];
  validatedAt: string | null;
}

export interface ImportRowError {
  rowNumber: number;
  columnName: string;
  code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  valueMasked: string | null;
  employeeCode: string | null;
}

export type DataType = 'ATTENDANCE' | 'PENALTY' | 'PAYROLL';

export type WorkflowStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'LOCKED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type PeriodStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'LOCKED'
  | 'CANCELLED';

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string | null;
  departmentCode: string;
  position: string | null;
  employmentStatus: string;
  hiredAt: string;
  terminatedAt: string | null;
  larkSyncStatus: string | null;
  wallet: {
    addressMasked: string | null;
    platform: string | null;
    network: string | null;
    ownerNameMasked: string | null;
    effectiveAt: string | null;
    source: string | null;
    hasImage: boolean;
  };
  portalAccount?: EmployeePortalAccount | null;
}

export interface EmployeePortalAccount {
  id: string;
  username: string;
  email: string | null;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}

export interface SyncCounters {
  larkTotal: number;
  toCreate: number;
  toUpdate: number;
  needsConfirmation: number;
  missingInLark: number;
  conflicts: number;
  unchanged: number;
  skippedWithoutUnionId: number;
}

export interface SyncChange {
  _id?: string;
  id?: string;
  changeType: string;
  requiresConfirmation: boolean;
  confirmed: boolean;
  applied: boolean;
  skipReason: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  unionId: string | null;
  larkUserId: string | null;
  fields: Array<{ field: string; before: string | null; after: string | null }>;
  note: string | null;
}

export interface EmployeeSyncSession {
  id: string;
  code: string;
  status: WorkflowStatus;
  larkFetchedAt: string | null;
  appliedAt?: string | null;
  counters: SyncCounters;
  changes?: SyncChange[];
  rejectionReason?: string | null;
}

export interface AttendanceRecord {
  id: string;
  source: 'staging' | 'published';
  employeeId: string | null;
  employeeCode?: string;
  period: string;
  importSessionId: string | null;
  status?: WorkflowStatus;
  version: number;
  changeReason?: string | null;
  periodWorkingDays: string | null;
  actualWorkedDays: string | null;
  overtimeDays: string | null;
  specialLeaveDays: string | null;
  unpaidLeaveDays: string | null;
  employedDays: string | null;
  penaltyAmount?: string | null;
  note: string | null;
  isCurrent?: boolean;
  isLocked?: boolean;
  publishedAt?: string | null;
  summary?: {
    periodWorkingDays: string | null;
    actualWorkedDays: string | null;
    overtimeDays: string | null;
    specialLeaveDays: string | null;
    unpaidLeaveDays: string | null;
  };
}

export interface PenaltyRecord {
  id: string;
  source: 'staging' | 'published';
  employeeId: string | null;
  employeeCode?: string;
  period: string;
  importSessionId: string | null;
  status?: WorkflowStatus;
  version: number;
  amount: string | null;
  currency: string | null;
  penaltyReason: string | null;
  penaltyStatus: string | null;
  note: string | null;
  totalAmount?: string | null;
  isCurrent?: boolean;
  isLocked?: boolean;
  publishedAt?: string | null;
}

export interface PayrollComponent {
  code: string;
  kind: string;
  label?: string;
  amount?: string | number;
}

export interface PayrollRecord {
  id: string;
  source: 'staging' | 'published';
  employeeId: string | null;
  employeeCode?: string;
  period: string;
  importSessionId: string | null;
  status?: WorkflowStatus;
  version: number;
  baseSalary: string | null;
  totalBaseSalary: string | null;
  periodSalary: string | null;
  payableDays: string | null;
  overtimeHours: string | null;
  grossAmount: string | null;
  totalDeduction: string | null;
  netAmount: string | null;
  usdtAmount: string | null;
  components?: PayrollComponent[];
  formulaVersion: string | null;
  note: string | null;
  isCurrent?: boolean;
  isLocked?: boolean;
  publishedAt?: string | null;
}

export interface PendingApproval {
  sessionId: string;
  code: string;
  dataType: DataType;
  period: string;
  totals: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    totalAmount: string | null;
  };
  submittedAt: string | null;
  submittedBy: string | null;
}

export interface DataPeriod {
  id: string;
  dataType: DataType;
  period: string;
  status: PeriodStatus;
  currentVersion: number;
  recordCount: number;
  publishedAt: string | null;
  lockedAt: string | null;
  isLocked?: boolean;
}

export interface ComplaintMessage {
  id: string;
  authorType: string;
  authorId: string;
  content: string;
  internalOnly: boolean;
  createdAt: string | null;
}

export interface ComplaintCorrection {
  cannotPatchPublished: boolean;
  instruction: string;
  listPath: string;
  patchPath: string;
  patchPermission: string;
  query: {
    period: string;
    employeeId: string;
    source: 'staging' | 'published';
  };
}

export interface Complaint {
  id: string;
  code: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string | null;
  departmentCode: string | null;
  subjectType: DataType;
  period: string;
  dataVersion: number;
  subjectId: string | null;
  reason: string;
  attachments: Array<{
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    malwareScanned: boolean;
  }>;
  status: string;
  assigneeId: string | null;
  assignedAt: string | null;
  messages: ComplaintMessage[];
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  adjustmentImportSessionId: string | null;
  correction?: ComplaintCorrection | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  extraPermissions: string[];
  dataScope: DataScope;
  status: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EmployeeFileImportResult {
  sheetName: string;
  created: number;
  updated: number;
  unchanged: number;
  errors: { rowNumber: number; employeeCode: string | null; message: string }[];
}

export interface WalletChangeRequest {
  id: string;
  code: string;
  employeeId: string;
  employeeCode: string;
  platform: string;
  network: string;
  addressMasked: string;
  ownerNameMasked: string;
  previousAddressMasked: string | null;
  reason: string;
  status: string;
  requiresException: boolean;
  exceptionReason: string | null;
  hrVerifiedBy: string | null;
  hrVerifiedAt: string | null;
  hrNote: string | null;
  employeeConsentedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  hasImage: boolean;
  effectiveAt: string | null;
  appliedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WalletLockWindow {
  id: string;
  period: string;
  lockFrom: string;
  lockUntil: string;
  isActive: boolean;
  requiredApproverPermission: string;
  requiredApproverCount: number;
  note: string | null;
}

export interface VaultApproval {
  approverId: string;
  approvedAt: string;
  mfaVerified: boolean;
}

export interface VaultRecoveryRequest {
  id: string;
  code: string;
  employeeId: string;
  employeeCode: string | null;
  reason: string;
  scopes: string[];
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  status: string;
  requiredApprovals: number;
  approvals: VaultApproval[];
  rejectionReason: string | null;
  executedAt: string | null;
  dekRewrapped: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ControlledDecryptRequest {
  id: string;
  code: string;
  purpose: string;
  justification: string;
  employeeIds: string[];
  fieldScopes: string[];
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  status: string;
  requiredApprovals: number;
  approvals: VaultApproval[];
  rejectionReason: string | null;
  executedAt: string | null;
  decryptedRecordCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PeriodOverviewView = 'all' | 'missing' | 'unconfirmed';
export type PeriodOverviewSource = 'staging' | 'published';
export type HrDataType = 'ATTENDANCE' | 'PENALTY' | 'PAYROLL';

export interface PeriodEmployeeTypeStatus {
  staging: boolean;
  published: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
}

export interface PeriodCoverageSummary {
  dataType: HrDataType;
  periodStatus: string | null;
  currentVersion: number | null;
  rosterCount: number;
  stagingPresent: number;
  stagingMissing: number;
  publishedPresent: number;
  publishedMissing: number;
  confirmed: number;
  unconfirmed: number;
}

export interface PeriodOverviewEmployee {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentCode: string;
  employmentStatus: string;
  attendance: PeriodEmployeeTypeStatus;
  penalty: PeriodEmployeeTypeStatus;
  payroll: PeriodEmployeeTypeStatus;
  missingTypes: HrDataType[];
  unconfirmedTypes: HrDataType[];
}

export interface PeriodOverview {
  period: string;
  view: PeriodOverviewView;
  source: PeriodOverviewSource;
  rosterCount: number;
  summaries: PeriodCoverageSummary[];
  page: number;
  pageSize: number;
  total: number;
  items: PeriodOverviewEmployee[];
}

export interface AuditEvent {
  eventId: string;
  sequence: number;
  occurredAt: string;
  actorUserId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  employeeId: string | null;
  reason: string | null;
  result: string;
  requestId: string | null;
  previousEventHash: string | null;
  eventHash: string | null;
}
