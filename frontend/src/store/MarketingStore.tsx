// Backward-compatible shim: the marketing/CEO shared state now lives in AppStore
// (it grew to cover quotations, lead assignment, and field-visit tracking used by
// both the CEO and Marketing portals). Existing imports of `useMarketing` /
// `MarketingProvider` keep working unchanged.
export { AppProvider as MarketingProvider, useApp as useMarketing } from './AppStore'
export type { CallLogEntry } from '../types/models'
