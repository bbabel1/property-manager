/**
 * Canonical token values for contexts that cannot consume CSS variables
 * (e.g., server-rendered email/PDF templates). Keep this file in sync with
 * `styles/tokens.css`.
 */
export const designTokens = {
  colors: {
    textPrimary: '#1f3d56',
    textMuted: '#738495',
    textOnAccent: '#ffffff',
    borderStrong: '#ccd3db',
    borderAccent: '#A2B7DE',
    surfaceDefault: '#ffffff',
    surfaceMuted: '#f5f7fa',
    surfacePanel: '#f9fbff',
    surfaceHighlight: '#f0f9ff',
    surfaceInfo: '#f3f6fb',
    surfaceInfoBorder: '#d3dde8',
    infoText: '#3e586d',
    primary: '#164AAC',
    primaryStrong: '#133F92',
    success: '#4f7452',
    danger: '#d94841',
  },
  interaction: {
    focusRing: 'rgba(22, 74, 172, 0.45)',
  },
  typography: {
    heading: "'Source Sans 3', 'Source Sans Pro', 'Open Sans', system-ui, -apple-system, sans-serif",
    body: "'Source Sans 3', 'Source Sans Pro', 'Open Sans', system-ui, -apple-system, sans-serif",
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '2.5rem',
    xxxl: '3rem',
  },
} as const;

export type DesignTokens = typeof designTokens;
