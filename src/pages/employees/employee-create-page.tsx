import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { dateInputToIso } from '@/lib/period';
import { createEmployee } from '@/services/employee.service';

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

export function EmployeeCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [position, setPosition] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('ACTIVE');
  const [payrollProcess, setPayrollProcess] = useState('INTERNAL');
  const [unionId, setUnionId] = useState('');
  const [userId, setUserId] = useState('');
  const [hiredAt, setHiredAt] = useState('');
  const [reason, setReason] = useState('');
  const [stepUp, setStepUp] = useState<{ retry: () => void } | null>(null);

  const canSubmit =
    employeeCode.trim().length > 0 &&
    fullName.trim().length > 0 &&
    departmentCode.trim().length > 0 &&
    hiredAt.length === 10 &&
    reason.trim().length >= 10;

  const save = useMutation({
    mutationFn: () =>
      createEmployee({
        employeeCode: employeeCode.trim(),
        fullName: fullName.trim(),
        workEmail: workEmail.trim() || null,
        departmentCode: departmentCode.trim(),
        regionCode: regionCode.trim() || null,
        position: position.trim() || null,
        employmentStatus,
        payrollProcess,
        unionId: unionId.trim() || null,
        userId: userId.trim() || null,
        hiredAt: dateInputToIso(hiredAt) ?? hiredAt,
        reason: reason.trim(),
      }),
    onSuccess: (employee) => {
      toast.success(t('employees.createdProfile'));
      navigate(`/employees/${employee.id}`);
    },
    onError: (error) => runOrStepUp(error, () => setStepUp({ retry: () => save.mutate() })),
  });

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={t('employees.createTitle')}
        description={t('employees.createDescription')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/employees">{t('common.back')}</Link>
          </Button>
        }
      />
      <form
        className={`${cardClass} space-y-4 p-6`}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) save.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('employees.code')}</Label>
            <Input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.name')}</Label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.workEmail')}</Label>
            <Input type="email" value={workEmail} onChange={(event) => setWorkEmail(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.department')}</Label>
            <Input value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.region')}</Label>
            <Input value={regionCode} onChange={(event) => setRegionCode(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.position')}</Label>
            <Input value={position} onChange={(event) => setPosition(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.hiredAt')}</Label>
            <Input type="date" value={hiredAt} onChange={(event) => setHiredAt(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.status')}</Label>
            <Select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)}>
              <option value="ACTIVE">{t('employment.ACTIVE')}</option>
              <option value="ON_LEAVE">{t('employment.ON_LEAVE')}</option>
              <option value="SUSPENDED">{t('employment.SUSPENDED')}</option>
              <option value="TERMINATED">{t('employment.TERMINATED')}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.payrollProcess')}</Label>
            <Select value={payrollProcess} onChange={(event) => setPayrollProcess(event.target.value)}>
              <option value="INTERNAL">{t('payrollProcess.INTERNAL')}</option>
              <option value="LARK">{t('payrollProcess.LARK')}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.unionId')}</Label>
            <Input value={unionId} onChange={(event) => setUnionId(event.target.value)} />
            <p className={`text-[10px] ${textSubtle}`}>{t('employees.larkOptional')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('employees.larkUserId')}</Label>
            <Input value={userId} onChange={(event) => setUserId(event.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('common.reason')}</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={!canSubmit || save.isPending}>
          {save.isPending ? t('common.processing') : t('employees.createSubmit')}
        </Button>
      </form>
      <StepUpDialog
        open={Boolean(stepUp)}
        action="employee:write:create"
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}
