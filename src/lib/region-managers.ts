import type { AdminUser } from '@/types/api';

export interface RegionManager {
  id: string;
  name: string;
}

export function managersByRegion(users: AdminUser[]) {
  const names = new Map<string, RegionManager[]>();
  for (const user of users) {
    if (user.status && user.status !== 'ACTIVE') continue;
    for (const code of user.dataScope.regionCodes ?? []) {
      const region = code.trim();
      if (!region) continue;
      const current = names.get(region) ?? [];
      if (!current.some((manager) => manager.id === user.id)) {
        current.push({ id: user.id, name: user.fullName || user.username });
      }
      names.set(region, current);
    }
  }
  return names;
}
