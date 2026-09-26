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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { downloadWalletImportTemplate } from '@/lib/excel-templates';
import { importEmployeeWallets } from '@/services/employee.service';
import type { EmployeeWalletImportResult } from '@/types/api';

export function EmployeeWalletImportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<EmployeeWalletImportResult | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const importFile = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t('imports.file'));
      return importEmployeeWallets(file, reason.trim());
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t('employees.walletImported'));
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error);
      if (/xac thuc lai|xác thực lại/i.test(message)) {
        setStepUp({ action: 'employees:wallets:import', retry: () => importFile.mutate() });
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
          importFile.mutate();
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
              other: result.summary.other,
            })}
          </p>
          {result.errors.length ? (
            <ul className="space-y-1 text-[#f87171]">
              {result.errors.map((error) => (
                <li key={`${error.rowNumber}-${error.code}-${error.employeeCode ?? ''}`}>
                  {t('imports.row')} {error.rowNumber}
                  {error.employeeCode ? ` (${error.employeeCode})` : ''}
                  {error.addressMasked ? ` · ${error.addressMasked}` : ''}: {error.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9aa3b5]">{t('common.noData')}</p>
          )}
        </div>
      ) : null}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}
