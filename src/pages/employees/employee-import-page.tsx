import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { downloadEmployeeRosterTemplate } from '@/lib/excel-templates';
import { importEmployees } from '@/services/employee.service';
import type { EmployeeFileImportResult } from '@/types/api';

export function EmployeeImportPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<EmployeeFileImportResult | null>(null);

  const importFile = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t('imports.file'));
      return importEmployees(file);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(t('employees.imported'));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
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
          <p className="text-xs text-[#9aa3b5]">{t('employees.importHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!file || importFile.isPending}>
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
          {result.errors.length ? (
            <ul className="space-y-1 text-[#f87171]">
              {result.errors.map((error) => (
                <li key={`${error.rowNumber}-${error.message}`}>
                  {t('imports.row')} {error.rowNumber}
                  {error.employeeCode ? ` (${error.employeeCode})` : ''}: {error.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#9aa3b5]">{t('common.noData')}</p>
          )}
        </div>
      ) : null}
    </PageContainer>
  );
}
