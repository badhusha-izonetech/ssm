import { Ionicons } from '@expo/vector-icons';

/**
 * Recognized designations. Matching is case-insensitive substring matching
 * against the authenticated employee's `designation` (falling back to
 * `department`) — see resolveRole() — so ERP variants like "Site Visit
 * Executive" or "Field Technician - Solar" still resolve correctly.
 * Driver, Accountant, Warehouse, Partner, CEO, Project Head, and any
 * unrecognized designation all resolve to 'generic', which has
 * `canTrack: false` — only direct_marketing/site_visit/field_technician
 * (and, going forward, whatever matches those three patterns) are field-
 * mobility execution roles.
 */
export type RoleKey = 'telecaller' | 'direct_marketing' | 'site_visit' | 'field_technician' | 'generic';

export type SiteVisitModuleKey =
  | 'selfie'
  | 'generalPhotos'
  | 'installationPhotos'
  | 'periodicPhotos'
  | 'video'
  | 'measurements'
  | 'materials'
  | 'siteVisitForm'
  | 'documents'
  | 'notes'
  | 'equipmentBefore'
  | 'siteEvidenceReview'
  | 'workProgress'
  | 'equipmentAfter';


export interface RoleConfig {
  key: RoleKey;
  label: string;
  /** Shown on Home as the greeting/role line and in role-aware copy. */
  shortLabel: string;
  /** Home screen's primary "start field work" CTA copy. */
  startActionLabel: string;
  /** Route to push when the primary CTA is pressed. */
  startRoute: 'StartTracking' | 'EquipmentBefore' | 'ProjectSelection';
  /** Which Site Visit hub modules apply to this role, in display order. */
  siteVisitModules: SiteVisitModuleKey[];
  /** Whether this role goes through Before/After equipment custody. */
  usesEquipmentCustody: boolean;
  /** Whether this role reviews existing site evidence before starting work. */
  reviewsSiteEvidence: boolean;
  /**
   * Whether this designation is one of the three approved field-mobility
   * execution roles (Direct Marketing Executive, Site Engineer, Field
   * Technician). Only these hold real `field_movements:write` server-side
   * (see backend/app/core/permissions.py ROLE_PERMISSIONS) — every other
   * designation, including Telecaller and any unrecognized/'generic'
   * designation, must NOT be offered the Start Tracking / selfie / photo /
   * video / measurement / document flow at all. Callers (TodayWorkScreen)
   * gate the "start field work" card on this flag rather than assuming
   * every RoleConfig is trackable just because it has a `startRoute`.
   */
  canTrack: boolean;
  /**
   * Whether the employee must choose DIRECT MARKET vs SITE VISIT before
   * starting tracking. Per spec, the designation does NOT determine the
   * work type — a Direct Marketing Executive may choose Site Visit and
   * vice versa; this is real, persisted business data (§6/§59), not just
   * a navigation choice.
   */
  choosesWorkType: boolean;
  homeIcon: keyof typeof Ionicons.glyphMap;
}

const CONFIGS: Record<RoleKey, RoleConfig> = {
  telecaller: {
    key: 'telecaller',
    label: 'Telecaller',
    shortLabel: 'Telecaller',
    // Telecaller is explicitly excluded from field tracking/execution —
    // the backend's Telecaller permission set has no field_movements:write
    // at all, so offering a working-looking Start Tracking button here
    // would just fail against the API with a 403 (the exact pattern the
    // spec says is unacceptable). No startRoute/modules are used while
    // canTrack is false; TodayWorkScreen doesn't render the start card.
    startActionLabel: 'Start Field Visit',
    startRoute: 'StartTracking',
    siteVisitModules: [],
    usesEquipmentCustody: false,
    reviewsSiteEvidence: false,
    canTrack: false,
    choosesWorkType: false,
    homeIcon: 'call-outline',
  },
  direct_marketing: {
    key: 'direct_marketing',
    label: 'Direct Marketing',
    shortLabel: 'Marketing',
    startActionLabel: 'Start Marketing Visit',
    startRoute: 'StartTracking',
    siteVisitModules: ['selfie', 'generalPhotos', 'video', 'notes', 'siteEvidenceReview'],
    usesEquipmentCustody: false,
    reviewsSiteEvidence: true,
    canTrack: true,
    choosesWorkType: true,
    homeIcon: 'megaphone-outline',
  },
  site_visit: {
    key: 'site_visit',
    label: 'Site Engineer',
    shortLabel: 'Site Engineer',
    startActionLabel: 'Start Site Visit',
    startRoute: 'StartTracking',
    siteVisitModules: [
      'selfie',
      'generalPhotos',
      'installationPhotos',
      'video',
      'siteVisitForm',
      'notes',
      'siteEvidenceReview',
    ],
    usesEquipmentCustody: false,
    reviewsSiteEvidence: true,
    canTrack: true,
    choosesWorkType: true,
    homeIcon: 'business-outline',
  },
  field_technician: {
    key: 'field_technician',
    label: 'Field Technician',
    shortLabel: 'Technician',
    startActionLabel: 'Check Equipment & Start',
    startRoute: 'ProjectSelection',
    siteVisitModules: [
      'equipmentBefore',
      'selfie',
      'installationPhotos',
      'periodicPhotos',
      'equipmentAfter',
      'siteEvidenceReview',
    ],
    usesEquipmentCustody: true,
    reviewsSiteEvidence: true,
    canTrack: true,
    choosesWorkType: false,
    homeIcon: 'construct-outline',
  },

  generic: {
    key: 'generic',
    label: 'Field Employee',
    shortLabel: 'Field Employee',
    startActionLabel: 'Start Tracking',
    startRoute: 'StartTracking',
    // Any designation that isn't Direct Marketing Executive, Site
    // Engineer, or Field Technician falls here — Accountant, Warehouse,
    // Partner, Driver, Document Follow-up, CEO, Project Head, or any
    // custom/unrecognized designation string. This used to retain "full
    // common functionality... don't unnecessarily restrict" (real
    // siteVisitModules + a working StartTracking route), which was a
    // genuine gap: at least Driver and Document Follow-up Executive DO
    // hold real field_movements:write server-side (for their own,
    // separate, pre-existing flows unrelated to this mobile rollout — see
    // web FieldMobility.tsx's Driver check-in demo), so this fallback
    // wasn't just a dead UI, it was a working field-tracking session any
    // of those designations could actually start from the phone app.
    // canTrack: false closes that off — no start card, no field-mobility
    // screens — regardless of what the backend would separately allow.
    siteVisitModules: [],
    usesEquipmentCustody: false,
    reviewsSiteEvidence: false,
    canTrack: false,
    choosesWorkType: false,
    homeIcon: 'briefcase-outline',
  },
};

const MATCHERS: [RegExp, RoleKey][] = [
  [/technician/i, 'field_technician'],
  [/(direct\s*)?marketing/i, 'direct_marketing'],
  [/site\s*(visit|visitor|engineer)/i, 'site_visit'],
  [/engineer/i, 'site_visit'],
  [/telecaller|tele\s*caller/i, 'telecaller'],
];

/** Resolves an employee's designation (falling back to department) to a RoleConfig. Never throws. */
export function resolveRole(designation?: string | null, department?: string | null): RoleConfig {
  const source = `${designation || ''} ${department || ''}`.trim();
  if (source) {
    for (const [pattern, key] of MATCHERS) {
      if (pattern.test(source)) return CONFIGS[key];
    }
  }
  return CONFIGS.generic;
}

export function getRoleConfig(key: RoleKey): RoleConfig {
  return CONFIGS[key];
}

/**
 * Returns the appropriate Site Visit modules for a given work_type.
 * If work_type is 'DIRECT MARKET', returns only selfie, photos, and notes.
 * If work_type is 'SITE VISIT', returns the full site visit suite.
 * If a role has specialized modules (e.g. field_technician), that can be provided as fallback.
 */
export function getModulesForWorkType(
  workType?: string | null,
  fallbackModules?: SiteVisitModuleKey[]
): SiteVisitModuleKey[] {
  if (fallbackModules && fallbackModules.includes('equipmentBefore')) {
    return fallbackModules;
  }
  const normalized = (workType || '').toUpperCase().trim();
  if (normalized === 'DIRECT MARKET' || normalized === 'DIRECT_MARKETING') {
    return ['selfie', 'generalPhotos', 'video', 'notes', 'siteEvidenceReview'];
  }
  if (normalized === 'SITE VISIT' || normalized === 'SITE_VISIT') {
    return [
      'selfie',
      'generalPhotos',
      'installationPhotos',
      'video',
      'siteVisitForm',
      'notes',
      'siteEvidenceReview',
    ];
  }
  if (fallbackModules && fallbackModules.length > 0) {
    return fallbackModules;
  }
  return [
    'selfie',
    'generalPhotos',
    'installationPhotos',
    'video',
    'siteVisitForm',
    'notes',
    'siteEvidenceReview',
  ];
}

