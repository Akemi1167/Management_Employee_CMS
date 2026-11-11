import type { TFunction } from 'i18next';
import type { AuditEvent } from '@/types/api';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function isObjectIdText(value: string | null | undefined): boolean {
  return Boolean(value && OBJECT_ID.test(value.trim()));
}

export function auditActionLabel(t: TFunction, action: string | null | undefined): string {
  if (!action) return '—';
  return t(`audit.actions.${action}`, { defaultValue: action });
}

export function auditResourceTypeLabel(t: TFunction, resourceType: string | null | undefined): string {
  if (!resourceType) return '—';
  return t(`audit.resources.${resourceType}`, { defaultValue: resourceType.replace(/_/g, ' ') });
}

function readable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || isObjectIdText(trimmed) || trimmed === 'null') return null;
  return trimmed;
}

export function auditActorLabel(t: TFunction, row: AuditEvent): string {
  return (
    readable(row.actor) ||
    readable(row.actorLabel) ||
    (row.actorRole === 'employee' ? t('audit.employeeActor') : null) ||
    t('audit.unknownActor')
  );
}

export function auditTargetLabel(t: TFunction, row: AuditEvent): string {
  const type = auditResourceTypeLabel(t, row.resourceType);
  const person =
    row.employeeCode && row.employeeName
      ? `${row.employeeCode} · ${row.employeeName}`
      : readable(row.employeeCode) || readable(row.employeeName);
  const extra =
    person ||
    readable(row.resourceLabel) ||
    readable(stringDetail(row, 'username')) ||
    readable(stringDetail(row, 'filename')) ||
    readable(stringDetail(row, 'period'));

  if (!extra || extra === type) return type;
  if (extra.startsWith(type)) return extra;
  return `${type} · ${extra}`;
}

function stringDetail(row: AuditEvent, key: string): string | null {
  const value = row.detail?.[key];
  return typeof value === 'string' ? value : null;
}
