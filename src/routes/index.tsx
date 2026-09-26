import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { AuthGuard, CmsPageGuard, GuestGuard } from '@/components/auth/auth-guard';
import { LoginPage } from '@/pages/auth/login-page';
import { ChangePasswordPage } from '@/pages/auth/change-password-page';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { EmployeesListPage } from '@/pages/employees/employees-list-page';
import { EmployeeImportPage } from '@/pages/employees/employee-import-page';
import { EmployeeWalletImportPage } from '@/pages/employees/employee-wallet-import-page';
import { EmployeeDetailPage } from '@/pages/employees/employee-detail-page';
import { EmployeeSyncDetailPage, EmployeeSyncListPage } from '@/pages/employees/employee-sync-page';
import { ImportCreatePage, ImportDetailPage, ImportsListPage } from '@/pages/imports/imports-pages';
import { AttendanceListPage, PayrollListPage, PenaltiesListPage } from '@/pages/hr/hr-records-pages';
import { ApprovalsListPage, PublishingPage } from '@/pages/workflow/workflow-pages';
import { ComplaintDetailPage, ComplaintsListPage } from '@/pages/complaints/complaints-pages';
import { UserCreatePage, UserDetailPage, UsersListPage } from '@/pages/users/users-pages';
import { WalletRequestDetailPage, WalletRequestsPage } from '@/pages/wallet/wallet-pages';
import { VaultDecryptDetailPage, VaultPage, VaultRecoveryDetailPage } from '@/pages/vault/vault-pages';
import { AuditListPage } from '@/pages/audit/audit-list-page';
import { PeriodOverviewPage } from '@/pages/reports/period-overview-page';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestGuard />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route path="account/password" element={<ChangePasswordPage />} />
            <Route path="account" element={<ChangePasswordPage />} />
            <Route element={<CmsPageGuard />}>
              <Route index element={<DashboardPage />} />
              <Route path="employees" element={<EmployeesListPage />} />
              <Route path="employees/import" element={<EmployeeImportPage />} />
              <Route path="employees/wallets/import" element={<EmployeeWalletImportPage />} />
              <Route path="employees/:id" element={<EmployeeDetailPage />} />
              <Route path="employee-sync" element={<EmployeeSyncListPage />} />
              <Route path="employee-sync/:id" element={<EmployeeSyncDetailPage />} />
              <Route path="imports" element={<ImportsListPage />} />
              <Route path="imports/create" element={<ImportCreatePage />} />
              <Route path="imports/:id" element={<ImportDetailPage />} />
              <Route path="attendance" element={<AttendanceListPage />} />
              <Route path="penalties" element={<PenaltiesListPage />} />
              <Route path="payroll" element={<PayrollListPage />} />
              <Route path="period-overview" element={<PeriodOverviewPage />} />
              <Route path="approvals" element={<ApprovalsListPage />} />
              <Route path="publishing" element={<PublishingPage />} />
              <Route path="complaints" element={<ComplaintsListPage />} />
              <Route path="complaints/:id" element={<ComplaintDetailPage />} />
              <Route path="wallet" element={<WalletRequestsPage />} />
              <Route path="wallet/:id" element={<WalletRequestDetailPage />} />
              <Route path="vault" element={<VaultPage />} />
              <Route path="vault/recovery/:id" element={<VaultRecoveryDetailPage />} />
              <Route path="vault/decrypt/:id" element={<VaultDecryptDetailPage />} />
              <Route path="users" element={<UsersListPage />} />
              <Route path="users/create" element={<UserCreatePage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
              <Route path="audit" element={<AuditListPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
