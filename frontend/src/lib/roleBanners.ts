import ceoBanner from '../assets/ceo.png'
import marketingBanner from '../assets/markeing.png'
import directMarketingBanner from '../assets/directmarkeing.png'
import siteVisitBanner from '../assets/sitevisit.png'
import partnerBanner from '../assets/partner.png'
import warehouseBanner from '../assets/warehouse.png'
import transportBanner from '../assets/transport.png'
import technicianBanner from '../assets/fieldtechnician.png'
import documentBanner from '../assets/documentfollowup.png'
import accountBanner from '../assets/account.png'
import projectHeadBanner from '../assets/projecthead.png'
import type { PortalKey } from '../auth/AuthContext'

/**
 * Centralized Role → Banner Mapping
 * 
 * Maps each logged-in user portal key to its dedicated asset:
 * - CEO                  → ceo.png
 * - Telecalling          → markeing.png
 * - Direct Marketing     → directmarkeing.png
 * - Site Visit           → sitevisit.png
 * - Partner              → partner.png
 * - Warehouse            → warehouse.png
 * - Transport            → transport.png
 * - Field Technician     → fieldtechnician.png
 * - Document Follow-up   → documentfollowup.png
 * - Accountant           → account.png (found in assets)
 * - Project Head         → projecthead.png (found in assets)
 * 
 * ceo.png is NEVER used for other roles automatically.
 */
export const ROLE_BANNER_MAP: Record<PortalKey, string | null> = {
  'CEO': ceoBanner,
  'Telecalling': marketingBanner,
  'Direct Marketing': directMarketingBanner,
  'Site Visit': siteVisitBanner,
  'Partner': partnerBanner,
  'Warehouse': warehouseBanner,
  'Transport': transportBanner,
  'Field Technician': technicianBanner,
  'Document Follow-up': documentBanner,
  'Accountant': accountBanner,
  'Project Head': projectHeadBanner,
  'Quotation Dashboard': null,
}

/**
 * Returns the role-specific banner asset for a given portal or employee designation.
 * Returns null if no dedicated asset exists for the role (safe fallback).
 */
export function getRoleBanner(portal?: PortalKey | null, designation?: string): string | null {
  if (portal && portal in ROLE_BANNER_MAP) {
    return ROLE_BANNER_MAP[portal]
  }

  if (designation) {
    const d = designation.trim().toLowerCase()
    if (d === 'ceo') return ceoBanner
    if (d.includes('telecall')) return marketingBanner
    if (d.includes('direct marketing')) return directMarketingBanner
    if (d.includes('site visit') || d.includes('site visitor')) return siteVisitBanner
    if (d.includes('partner')) return partnerBanner
    if (d.includes('warehouse') || d.includes('stock')) return warehouseBanner
    if (d.includes('transport') || d.includes('driver')) return transportBanner
    if (d.includes('technician')) return technicianBanner
    if (d.includes('document') || d.includes('doc')) return documentBanner
    if (d.includes('account')) return accountBanner
    if (d.includes('project')) return projectHeadBanner
  }

  return null
}
