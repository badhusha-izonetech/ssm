// Central design system — matches design-reference.png:
// dark navy headers, white cards on a light gray canvas, Success Solar
// orange primary actions, green live/success states, red destructive
// actions, blue informational/map elements, rounded cards with subtle
// borders/shadows. Screens should pull from here rather than hardcoding
// colors so the theme stays consistent (per SCREEN ORDER item 1).

export const colors = {
  navy: '#0F172A',
  navyLight: '#F8FAFC',
  background: '#F1F5F9',
  card: '#FFFFFF',
  cardGlass: 'rgba(255, 255, 255, 0.88)',
  border: 'rgba(226, 232, 240, 0.9)',
  borderStrong: 'rgba(203, 213, 225, 0.95)',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  primary: '#0284C7',
  primaryDark: '#0369A1',
  primarySoft: 'rgba(2, 132, 199, 0.10)',

  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  info: '#0284C7',
  infoSoft: 'rgba(2, 132, 199, 0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
} as const;

export const typography = {
  h1: { fontSize: 22, fontWeight: '700' as const, color: colors.textPrimary },
  h2: { fontSize: 17, fontWeight: '700' as const, color: colors.textPrimary },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.textPrimary },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textMuted },
};

export const statusColor: Record<string, string> = {
  'Checked In': colors.info,
  'On Field': colors.success,
  Returning: colors.warning,
  'Checked Out': colors.textMuted,
};
