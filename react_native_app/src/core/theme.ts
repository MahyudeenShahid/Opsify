import { Platform } from 'react-native';

export const Theme = {
  colors: {
    background: '#070A0E', // Deep Soil Black
    surface: '#111622',    // Dark Foliage Carbon
    surfaceLight: '#1A2234', // Hover/Active states
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#00E676',    // Organic Farm Green
    primaryGlow: 'rgba(0, 230, 118, 0.2)',
    secondary: '#FFC400',  // Mango Gold
    success: '#00E676',    // Electric Salad Green
    successGlow: 'rgba(0, 230, 118, 0.2)',
    warning: '#FF9100',    // Sunset Amber
    error: '#FF2A55',      // Tomato Red
    text: '#FFFFFF',
    textMuted: '#8E9AA8',
    terminalBg: '#05070C',
    terminalBorder: '#1A2D20',
    glass: 'rgba(17, 22, 34, 0.7)',
  },
  gradients: {
    primary: ['#00E676', '#00B0FF'] as const,
    secondary: ['#FFC400', '#FF9100'] as const,
    success: ['#00E676', '#FFC400'] as const,
    surface: ['rgba(26, 34, 52, 0.9)', 'rgba(17, 22, 34, 0.9)'] as const,
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
