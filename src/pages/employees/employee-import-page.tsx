import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { downloadEmployeeRosterTemplate } from '@/lib/excel-templates';
import { importEmployees } from '@/services/employee.service';
import { useAuthStore } from '@/stores/auth-store';
import type { EmployeeFileImportResult } from '@/types/api';

function uniqueRegionCodes(codes: string[] | undefined): string[] {
  return [
    ...new Set(
      (codes ?? [])
        .map((code) => code.trim().toUpperCase().replace(/[\s-]+/g, '_'))
        .filter((code) => code !== ''),
    ),
  ];
}

export function EmployeeImportPage() {
  const { t } = useTranslation();
  const dataScope = useAuthStore((s) => s.user?.dataScope);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EmployeeFileImportResult | null>(null);
  const [stepUp, setStepUp] = useState<{ retry: () => void } | null>(null);

  const regions = useMemo(() => uniqueRegionCodes(dataScope?.regionCodes), [dataScope?.regionCodes]);
  const allEmployees = Boolean(dataScope?.allEmployees);
  const previewRegion = regions.length === 1 ? regions[0] : null;
  const blocked = !allEmployees && regions.length !== 1;

  const importFile = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t('imports.file'));
      return importEmployees(file);
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.created + data.updated > 0) {
        toast.success(
          t('employees.importedCounts', {
            created: data.created,
            updated: data.updated,
            unchanged: data.unchanged,
          }),
        );
      } else if (data.unchanged > 0) {
        toast.message(t('employees.importedAlreadyThere', { count: data.unchanged }));
      } else {
        toast.error(t('employees.importedNone'));
      }
    },
    onError: (error) => {
      const message = getApiErrorMessage(error);
      if (/xac thuc lai|xác thực lại/i.test(message)) {
        setStepUp({ retry: () => importFile.mutate() });
        return;
      }
      toast.error(message);
    },
  });

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={t('employees.importTitle')}
        description={t('employees.importDescription')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/employees">{t('common.back')}</Link>
          </Button>
        }
      />
      <form
        className={`${cardClass} space-y-4 p-6`}
        onSubmit={(e) => {
          e.preventDefault();
          if (blocked) return;
          importFile.mutate();
        }}
      >
        {previewRegion ? (
          <p className="rounded-lg border border-[#16a34a]/35 bg-[#16a34a]/10 px-3 py-2 text-sm text-[#4ade80]">
            {t('employees.importAssignRegion', { region: previewRegion })}
          </p>
        ) : blocked ? (
          <p className="rounded-lg border border-[#fbbf24]/35 bg-[#fbbf24]/10 px-3 py-2 text-sm text-[#fbbf24]">
            {regions.length > 1 ? t('employees.importNeedOneRegion') : t('employees.importNeedRegion')}
          </p>
        ) : (
          <p className="text-sm text-[#9aa3b5]">{t('employees.importAdminNoRegion')}</p>
        )}
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
          <p className="text-xs text-[#9aa3b5]">{t('employees.importHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!file || blocked || importFile.isPending}>
            {importFile.isPending ? t('common.processing') : t('employees.importSubmit')}
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadEmployeeRosterTemplate()}>
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
            {t('employees.created')}: {result.created} · {t('employees.updated')}: {result.updated} ·{' '}
            {t('employeeSync.unchanged')}: {result.unchanged}
          </p>
          {result.portalAccountsCreated != null ? (
            <p>
              {t('employees.portalAccountsCreated')}: {result.portalAccountsCreated}
            </p>
          ) : null}
          <p>
            {result.assignedRegion
              ? t('employees.importedRegion', { region: result.assignedRegion })
              : t('employees.importedNoRegion')}
          </p>
          {result.created + result.updated === 0 && result.unchanged > 0 ? (
            <p className="text-[#fbbf24]">{t('employees.importedAlreadyThere', { count: result.unchanged })}</p>
          ) : null}
          {result.errors.length > 0 ? (
            <ul className="space-y-1 text-[#f87171]">
              {result.errors.map((error) => (
                <li key={`${error.rowNumber}-${error.message}`}>
                  {t('imports.row')} {error.rowNumber}
                  {error.employeeCode ? ` (${error.employeeCode})` : ''}: {error.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9aa3b5]">{t('employees.importedNoRowErrors')}</p>
          )}
          <p>
            <Link to="/employees" className="text-[#4ade80] hover:underline">
              {t('employees.title')}
            </Link>
            {' · '}
            <Link to="/regions?unassigned=1" className="text-[#4ade80] hover:underline">
              {t('employees.unassignedRegion')}
            </Link>
          </p>
        </div>
      ) : null}
      <StepUpDialog
        open={Boolean(stepUp)}
        action="employees:import"
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}
