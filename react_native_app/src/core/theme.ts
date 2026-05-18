import { Platform } from 'react-native';

export const Theme = {
  colors: {
    background: '#0B0D14', // Deepest Void
    surface: '#151828',    // Elevated Carbon
    surfaceLight: '#1E2337', // Hover/Active states
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#00F0FF',    // Cyber Cyan
    primaryGlow: 'rgba(0, 240, 255, 0.2)',
    secondary: '#7000FF',  // Deep Neon Purple
    success: '#00FFA3',    // Electric Green
    successGlow: 'rgba(0, 255, 163, 0.2)',
    warning: '#FFB800',    // Sun Yellow
    error: '#FF2A55',      // Crimson Red
    text: '#FFFFFF',
    textMuted: '#8A91AB',
    terminalBg: '#05060A',
    terminalBorder: '#1A2F3D',
    glass: 'rgba(21, 24, 40, 0.65)',
  },
  gradients: {
    primary: ['#00F0FF', '#0080FF'] as const,
    secondary: ['#7000FF', '#B000FF'] as const,
    success: ['#00FFA3', '#00A3FF'] as const,
    surface: ['rgba(30, 35, 55, 0.9)', 'rgba(20, 24, 40, 0.9)'] as const,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 9999,
  },
  shadows: {
    glow: {
      shadowColor: '#00F0FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 5,
    },
    glass: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    }
  }
};
