// Re-export for backward compatibility with sidebar/page.tsx
export { detectModules, replaceModules } from '../lib/moduleParser'
export type { DetectedModule } from '../lib/moduleParser'

// Legacy default export - redirects to SnapConfigModal
export { default } from './SnapConfigModal'
