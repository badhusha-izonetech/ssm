import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { resolveRole, RoleConfig } from './roleConfig';

export function useRole(): RoleConfig {
  const { employee } = useAuth();
  return useMemo(() => resolveRole(employee?.designation, employee?.department), [employee?.designation, employee?.department]);
}
