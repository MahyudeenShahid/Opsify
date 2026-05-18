import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Mail, Lock, User, Globe, ChevronRight } from 'lucide-react-native';

import { Theme } from '../core/theme';
import { auth } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FirebaseChatService } from '../services/firebaseChatService';

export const AuthScreen = ({ onDemoLogin }: { onDemoLogin: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();

    // Subtle background pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, []);

  const handleEmailAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await FirebaseChatService.createUser(result.user.uid, name, email);
      }
    } catch (e: any) {
      Alert.alert('Authentication Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Notice', 'Google Auth on native requires specific Expo modules. Use the Web build for this MVP feature.');
      return;
    }
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await FirebaseChatService.createUser(result.user.uid, result.user.displayName || 'Google User', result.user.email || '');
    } catch (e: any) {
      Alert.alert('Google Auth Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();
    setTimeout(() => setIsLogin(!isLogin), 150);
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Animated Background */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={Theme.gradients.surface}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glowBlob1} />
        <View style={styles.glowBlob2} />
      </Animated.View>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Opsify</Text>
          <Text style={styles.subtitle}>Enter the Agentic Hub</Text>
        </View>

        <BlurView intensity={20} tint="dark" style={styles.glassCard}>
          {!isLogin && (
            <View style={styles.inputWrapper}>
              <User color={Theme.colors.textMuted} size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Theme.colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <Mail color={Theme.colors.textMuted} size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={Theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock color={Theme.colors.textMuted} size={20} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Theme.colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <AnimatedButton onPress={handleEmailAuth} disabled={isLoading} style={styles.primaryBtn}>
            <LinearGradient colors={Theme.gradients.primary} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.primaryBtnGradient}>
              {isLoading ? <ActivityIndicator color="#000" /> : (
                <>
                  <Text style={styles.primaryBtnText}>{isLogin ? 'Initialize Session' : 'Create Identity'}</Text>
                  <ChevronRight color="#000" size={20} />
                </>
              )}
            </LinearGradient>
          </AnimatedButton>

          <TouchableOpacity style={styles.switchMode} onPress={toggleAuthMode}>
            <Text style={styles.switchModeText}>
              {isLogin ? "New user? Generate an identity" : "Already registered? Initialize session"}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>EXTERNAL AUTH</Text>
            <View style={styles.dividerLine} />
          </View>

          <AnimatedButton onPress={handleGoogleAuth} disabled={isLoading} style={styles.googleBtn}>
            <Globe color="#FFF" size={20} style={{ marginRight: 8 }} />
            <Text style={styles.googleBtnText}>Authenticate via Google</Text>
          </AnimatedButton>

          <AnimatedButton onPress={onDemoLogin} style={styles.demoBtn}>
            <Text style={styles.demoBtnText}>Launch Developer Bypass (Demo)</Text>
          </AnimatedButton>
        </BlurView>
      </Animated.View>
    </View>
  );
};

// Reusable Animated Button
const AnimatedButton = ({ onPress, disabled, style, children }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowBlob1: {
    position: 'absolute',
    top: -100, left: -100,
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: Theme.colors.primaryGlow,
  },
  glowBlob2: {
    position: 'absolute',
    bottom: -100, right: -100,
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: Theme.colors.successGlow,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    padding: Theme.spacing.lg,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
    textShadowColor: Theme.colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  glassCard: {
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.glass,
    overflow: 'hidden',
    ...Theme.shadows.glass,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing.md,
    height: 54,
    paddingHorizontal: Theme.spacing.md,
  },
  inputIcon: {
    marginRight: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: Theme.colors.text,
    fontSize: 16,
    height: '100%',
  },
  primaryBtn: {
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    overflow: 'hidden',
    ...Theme.shadows.glow,
  },
  primaryBtnGradient: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
    textTransform: 'uppercase',
    marginRight: 8,
  },
  switchMode: {
    padding: Theme.spacing.md,
    alignItems: 'center',
  },
  switchModeText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border,
  },
  dividerText: {
    color: Theme.colors.textMuted,
    paddingHorizontal: Theme.spacing.md,
    fontSize: 10,
    letterSpacing: 1,
  },
  googleBtn: {
    flexDirection: 'row',
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  googleBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  demoBtn: {
    height: 54,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  demoBtnText: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  }
});
