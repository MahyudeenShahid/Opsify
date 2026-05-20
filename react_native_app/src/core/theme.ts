import { Platform } from 'react-native';

export const Theme = {
  colors: {
    background: '#070A0E',       // Deep cosmic black
    surface: '#0D1117',          // Elevated dark surface
    surfaceLight: '#161D2B',     // Hover/active states
    surfaceMid: '#1A2234',       // Cards, elevated panels
    border: 'rgba(255,255,255,0.07)',
    borderGlow: 'rgba(0,230,118,0.25)',
    primary: '#00E676',          // Signature neon green
    primaryDim: '#00C060',
    primaryGlow: 'rgba(0,230,118,0.18)',
    primaryDeep: 'rgba(0,230,118,0.08)',
    secondary: '#FFC400',        // Amber gold
    secondaryGlow: 'rgba(255,196,0,0.18)',
    accent: '#00B0FF',           // Electric blue
    accentGlow: 'rgba(0,176,255,0.18)',
    purple: '#7C3AED',
    purpleGlow: 'rgba(124,58,237,0.18)',
    success: '#00E676',
    successGlow: 'rgba(0,230,118,0.18)',
    warning: '#FF9100',
    warningGlow: 'rgba(255,145,0,0.18)',
    error: '#FF2A55',
    errorGlow: 'rgba(255,42,85,0.18)',
    text: '#FFFFFF',
    textSecondary: '#CBD5E1',
    textMuted: '#64748B',
    textDim: '#3D4A5C',
    terminalBg: '#05070C',
    terminalBorder: '#1A2D20',
    glass: 'rgba(13,17,23,0.75)',
    glassMid: 'rgba(22,29,43,0.85)',
    scrim: 'rgba(0,0,0,0.7)',
    notification: '#FF2A55',
  },

  gradients: {
    primary:    ['#00E676', '#00B0FF'] as const,
    primarySoft:['#00E676', '#00C060'] as const,
    secondary:  ['#FFC400', '#FF9100'] as const,
    accent:     ['#00B0FF', '#7C3AED'] as const,
    aurora:     ['#00E676', '#00B0FF', '#7C3AED'] as const,
    midnight:   ['#0D1117', '#161D2B'] as const,
    surface:    ['rgba(22,29,43,0.95)', 'rgba(13,17,23,0.95)'] as const,
    surfaceCard:['rgba(26,34,52,0.9)',  'rgba(17,22,34,0.9)']  as const,
    glow:       ['rgba(0,230,118,0.12)', 'rgba(0,230,118,0.0)'] as const,
    danger:     ['#FF2A55', '#FF9100'] as const,
    gold:       ['#FFC400', '#FFD700'] as const,
  },

  typography: {
    display:  { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
    heading1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
    heading2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
    heading3: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.1 },
    body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
    bodyMed:  { fontSize: 15, fontWeight: '500' as const },
    label:    { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.2 },
    caption:  { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.3 },
    micro:    { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.8 },
    mono:     { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  },

  spacing: {
    xs:  4,
    sm:  8,
    md:  16,
    lg:  24,
    xl:  32,
    xxl: 48,
    card: 16,
    section: 24,
    page: 20,
  },

  borderRadius: {
    xs:  4,
    sm:  8,
    md:  12,
    lg:  16,
    xl:  24,
    xxl: 32,
    pill: 9999,
  },

  shadows: {
    glow: {
      shadowColor: '#00E676',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    glowBlue: {
      shadowColor: '#00B0FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    glass: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    modal: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.6,
      shadowRadius: 32,
      elevation: 24,
    },
  },

  // Spring animation configs for Animated API
  animation: {
    spring: { friction: 8, tension: 60 },
    springFast: { friction: 10, tension: 100 },
    springBouncy: { friction: 6, tension: 50 },
    duration: {
      fast: 150,
      normal: 250,
      slow: 400,
      stagger: 40,  // ms between staggered items
    },
  },
};
