import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Database, Zap, Package, TrendingUp, Users, CheckCircle } from 'lucide-react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

interface Props {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [choice, setChoice] = useState<'seed' | 'empty' | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.spring(logoAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleChoice = async (type: 'seed' | 'empty') => {
    setChoice(type);
    setIsLoading(true);
    try {
      if (type === 'seed') {
        await ApiService.seedUserData();
      } else {
        await ApiService.initEmptyUser();
      }
      await new Promise(r => setTimeout(r, 1200));
      onComplete();
    } catch (e: any) {
      // Even if it fails, let the user in
      onComplete();
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#08091A', '#0D1226', '#0A1020']}
        style={StyleSheet.absoluteFill}
      />

      {/* Background glow */}
      <View style={styles.glow1} />
      <View style={styles.glow2} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoAnim }] }]}>
          <LinearGradient colors={Theme.gradients.primary} style={styles.logoGrad}>
            <Zap size={36} color="#000" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.welcomeTitle}>Welcome to Opsify</Text>
        <Text style={styles.welcomeSub}>
          Your intelligent ERP, built for modern business.{'\n'}
          How would you like to start?
        </Text>

        {isLoading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>
              {choice === 'seed' ? '🌱 Seeding your workspace with sample data...' : '🚀 Creating your empty workspace...'}
            </Text>
          </View>
        ) : (
          <View style={styles.options}>
            {/* Sample Data Option */}
            <TouchableOpacity style={styles.optionCard} onPress={() => handleChoice('seed')} activeOpacity={0.85}>
              <LinearGradient colors={['rgba(0,230,118,0.12)', 'rgba(0,230,118,0.04)']} style={StyleSheet.absoluteFill} />
              <View style={[styles.optionIcon, { borderColor: Theme.colors.primary }]}>
                <Database size={24} color={Theme.colors.primary} />
              </View>
              <Text style={styles.optionTitle}>Start with Sample Data</Text>
              <Text style={styles.optionDesc}>
                Pre-loaded with products, suppliers, warehouses, and demo transactions so you can explore every feature immediately.
              </Text>
              <View style={styles.optionFeatures}>
                {['4 Products', '2 Warehouses', '4 Suppliers', 'Demo Sales'].map(f => (
                  <View key={f} style={styles.featureChip}>
                    <CheckCircle size={10} color={Theme.colors.primary} />
                    <Text style={styles.featureChipText}>{f}</Text>
                  </View>
                ))}
              </View>
              <LinearGradient colors={Theme.gradients.primary} style={styles.optionButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.optionButtonText}>Load Sample Data →</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Fresh Start Option */}
            <TouchableOpacity style={[styles.optionCard, styles.optionCardAlt]} onPress={() => handleChoice('empty')} activeOpacity={0.85}>
              <LinearGradient colors={['rgba(0,176,255,0.10)', 'rgba(0,176,255,0.03)']} style={StyleSheet.absoluteFill} />
              <View style={[styles.optionIcon, { borderColor: '#00B0FF' }]}>
                <Package size={24} color="#00B0FF" />
              </View>
              <Text style={[styles.optionTitle, { color: '#00B0FF' }]}>Start Fresh</Text>
              <Text style={styles.optionDesc}>
                Begin with a completely empty workspace. Add your own products, suppliers, and inventory from scratch.
              </Text>
              <View style={styles.optionFeatures}>
                {['Clean Slate', 'Your Products', 'Your Prices', 'Full Control'].map(f => (
                  <View key={f} style={[styles.featureChip, { borderColor: 'rgba(0,176,255,0.3)', backgroundColor: 'rgba(0,176,255,0.08)' }]}>
                    <CheckCircle size={10} color="#00B0FF" />
                    <Text style={[styles.featureChipText, { color: '#00B0FF' }]}>{f}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.optionButton, { backgroundColor: 'rgba(0,176,255,0.15)', borderWidth: 1, borderColor: 'rgba(0,176,255,0.4)' }]}>
                <Text style={[styles.optionButtonText, { color: '#00B0FF' }]}>Start Empty →</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footerNote}>
          🔒 Your data is private and stored securely in Firebase under your account only.
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(0,230,118,0.06)', top: -80, left: -60, },
  glow2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(0,176,255,0.05)', bottom: 100, right: -60, },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40, alignItems: 'center' },

  logoWrap: { marginBottom: 24 },
  logoGrad: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: Theme.colors.primary, shadowRadius: 20, shadowOpacity: 0.4, elevation: 12 },

  welcomeTitle: { color: '#FFF', fontSize: 30, fontWeight: '900', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  welcomeSub: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 40 },

  loadingSection: { alignItems: 'center', gap: 20, marginTop: 40 },
  loadingText: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 22 },

  options: { width: '100%', gap: 16 },

  optionCard: { borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(0,230,118,0.25)', padding: 20, overflow: 'hidden' },
  optionCardAlt: { borderColor: 'rgba(0,176,255,0.25)' },

  optionIcon: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.04)' },
  optionTitle: { color: Theme.colors.primary, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  optionDesc: { color: Theme.colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 14 },

  optionFeatures: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)', backgroundColor: 'rgba(0,230,118,0.08)' },
  featureChipText: { color: Theme.colors.primary, fontSize: 10, fontWeight: '700' },

  optionButton: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionButtonText: { color: '#000', fontSize: 14, fontWeight: '900' },

  footerNote: { color: Theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 'auto', paddingTop: 24, lineHeight: 18 },
});
