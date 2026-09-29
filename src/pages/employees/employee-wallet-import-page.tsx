import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { downloadWalletImportTemplate } from '@/lib/excel-templates';
import { importEmployeeWallets } from '@/services/employee.service';
import type { EmployeeWalletImportResult } from '@/types/api';

const SHARED_WALLET_CODES = new Set(['WALLET_OWNED_BY_OTHER', 'DUPLICATE_WALLET_IN_FILE']);
const IMAGE_WARNING_CODES = new Set(['IMAGE_MISSING', 'IMAGE_STORE_FAILED']);
const SHARED_WARNING_CODES = new Set([
  'WALLET_OWNED_BY_OTHER',
  'DUPLICATE_WALLET_IN_FILE',
  'SHARED_WALLET_ACCEPTED',
]);

function sharedWalletCount(result: EmployeeWalletImportResult) {
  return result.errors.filter((error) => SHARED_WALLET_CODES.has(error.code)).length;
}

export function EmployeeWalletImportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<EmployeeWalletImportResult | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);
  const [confirmShared, setConfirmShared] = useState(false);

  const importFile = useMutation({
    mutationFn: (confirmSharedWallets = false) => {
      if (!file) throw new Error(t('imports.file'));
      return importEmployeeWallets(file, reason.trim(), confirmSharedWallets);
    },
    onSuccess: (data) => {
      setResult(data);
      setConfirmShared(false);
      if (sharedWalletCount(data) > 0) {
        toast.message(t('employees.walletImportNeedsConfirm'));
      } else {
        toast.success(t('employees.walletImported'));
      }
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error);
      if (/xac thuc lai|xác thực lại/i.test(message)) {
        setStepUp({ action: 'employees:wallets:import', retry: () => importFile.mutate(false) });
        return;
      }
      toast.error(message);
    },
  });

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={t('employees.walletImportTitle')}
        description={t('employees.walletImportDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/employees">{t('common.back')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/wallet">{t('nav.wallet')}</Link>
            </Button>
          </div>
        }
      />
      <form
        className={`${cardClass} space-y-4 p-6`}
        onSubmit={(e) => {
          e.preventDefault();
          importFile.mutate(false);
        }}
      >
        <div className="space-y-1.5">
          <Label>{t('imports.file')}</Label>
          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          <p className="text-xs text-[#9aa3b5]">{t('employees.walletImportHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('employees.walletImportReason')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!file || reason.trim().length < 10 || importFile.isPending}>
            {importFile.isPending ? t('common.processing') : t('employees.walletImportSubmit')}
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadWalletImportTemplate()}>
            <Download className="h-4 w-4" />
            {t('imports.downloadTemplate')}
          </Button>
        </div>
      </form>
      {result ? (
        <div className={`${cardClass} mt-4 space-y-3 p-6 text-sm`}>
          <p>
            {t('employees.importSheet')}: <strong>{result.sheetName}</strong>
          </p>
          <p>
            {t('employees.walletApplied')}: {result.applied} · {t('employeeSync.unchanged')}:{' '}
            {result.unchanged} · {t('employees.walletSkipped')}: {result.skipped}
          </p>
          <p className="text-xs text-[#9aa3b5]">
            {t('employees.walletImportSummary', {
              alreadyHasWallet: result.summary.alreadyHasWallet,
              sameWallet: result.summary.sameWallet,
              duplicateInFile: result.summary.duplicateInFile,
              walletOwnedByOther: result.summary.walletOwnedByOther,
              employeeNotFound: result.summary.employeeNotFound,
              imageFailed: result.summary.imageFailed ?? 0,
              sharedAccepted: result.summary.sharedAccepted ?? 0,
              other: result.summary.other,
            })}
          </p>
          {result.errors.length ? (
            <ul className="space-y-1">
              {result.errors.map((error) => (
                <li
                  key={`${error.rowNumber}-${error.code}-${error.employeeCode ?? ''}`}
                  className={
                    IMAGE_WARNING_CODES.has(error.code) || SHARED_WARNING_CODES.has(error.code)
                      ? 'text-[#fbbf24]'
                      : 'text-[#f87171]'
                  }
                >
                  {t('imports.row')} {error.rowNumber}
                  {error.employeeCode ? ` (${error.employeeCode})` : ''}
                  {error.addressMasked ? ` · ${error.addressMasked}` : ''}: {error.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9aa3b5]">{t('common.noData')}</p>
          )}
          {sharedWalletCount(result) > 0 ? (
            <Button type="button" variant="outline" disabled={importFile.isPending} onClick={() => setConfirmShared(true)}>
              {t('employees.walletImportConfirmShared')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmShared}
        onClose={() => setConfirmShared(false)}
        onConfirm={() => importFile.mutate(true)}
        title={t('employees.walletSharedConfirmTitle')}
        description={t('employees.walletImportConfirmSharedBody', {
          count: result ? sharedWalletCount(result) : 0,
        })}
        confirmLabel={t('employees.walletSharedConfirmSubmit')}
        loading={importFile.isPending}
      />
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}
