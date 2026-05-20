import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView, StatusBar, StyleSheet, Text, View,
  TouchableOpacity, Animated, Easing, Modal, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BrainCircuit, Boxes, MessageCircle, Navigation, Bot,
  TrendingUp, Settings, Eye, EyeOff, Bell,
} from 'lucide-react-native';

import { Theme } from './src/core/theme';
import { AppDataProvider } from './src/core/AppDataContext';
import { CustomerBrainScreen } from './src/screens/CustomerBrainScreen';
import { InventoryDashboardScreen } from './src/screens/InventoryDashboardScreen';
import { OmniChatScreen } from './src/screens/OmniChat/OmniChatScreen';
import { DeliveryIntelligenceScreen } from './src/screens/DeliveryIntelligenceScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ERPAgentScreen } from './src/screens/ERPAgentScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { auth } from './src/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { FirebaseChatService } from './src/services/firebaseChatService';
import { ApiService } from './src/services/api';
import { NotificationService } from './src/services/NotificationService';

type Tab = 'customer' | 'inventory' | 'omnichat' | 'logistics' | 'opsbot' | 'erpagent';

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'customer',  label: 'Brain',    Icon: BrainCircuit },
  { id: 'inventory', label: 'ERP Hub',  Icon: Boxes },
  { id: 'omnichat',  label: 'OmniChat', Icon: MessageCircle },
  { id: 'logistics', label: 'Delivery', Icon: Navigation },
  { id: 'opsbot',    label: 'OpsBot',   Icon: Bot },
  { id: 'erpagent',  label: 'Agent',    Icon: TrendingUp },
];

// ─── Premium Nav Button ───────────────────────────────────────────────────────

const NavButton = ({
  isActive, onPress, icon, label, badge,
}: {
  isActive: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const bgOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const textScale = useRef(new Animated.Value(isActive ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bgOpacity, { toValue: isActive ? 1 : 0, ...Theme.animation.springFast, useNativeDriver: true }),
      Animated.spring(textScale, { toValue: isActive ? 1 : 0.85, ...Theme.animation.springFast, useNativeDriver: true }),
    ]).start();
  }, [isActive]);

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.88, ...Theme.animation.springFast, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, ...Theme.animation.spring, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.navItemContainer}
    >
      <Animated.View style={[styles.navItem, { transform: [{ scale }] }]}>
        {/* Active pill background */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.navActivePill, { opacity: bgOpacity }]}>
          <LinearGradient
            colors={['rgba(0,230,118,0.18)', 'rgba(0,176,255,0.10)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {icon}
        <Animated.Text
          style={[
            styles.navText,
            isActive && styles.navTextActive,
            { transform: [{ scale: textScale }] },
          ]}
        >
          {label}
        </Animated.Text>

        {badge != null && badge > 0 && (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Bell Button ─────────────────────────────────────────────────────────────

const BellButton = ({ unreadCount, onPress }: { unreadCount: number; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (unreadCount > 0) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.2, ...Theme.animation.springBouncy, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, ...Theme.animation.spring, useNativeDriver: true }),
      ]).start();
    }
  }, [unreadCount]);

  return (
    <TouchableOpacity
      style={styles.bellBtn}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, ...Theme.animation.spring, useNativeDriver: true }).start()}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale }, { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) }] }}>
        <Bell size={20} color={unreadCount > 0 ? Theme.colors.primary : Theme.colors.textMuted} />
        {unreadCount > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Animated Loading Splash ──────────────────────────────────────────────────

const LoadingSplash = () => {
  const pulse = useRef(new Animated.Value(0.5)).current;
  const ring  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 900, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
  }, []);
  return (
    <View style={styles.splashContainer}>
      <Animated.View style={[styles.splashRing, {
        opacity: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.1, 0.3] }),
        transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
      }]} />
      <Animated.View style={[styles.splashIconWrap, { opacity: pulse }]}>
        <LinearGradient colors={Theme.gradients.primary} style={styles.splashGradient}>
          <BrainCircuit color="#000" size={32} />
        </LinearGradient>
      </Animated.View>
      <Animated.Text style={[styles.splashText, { opacity: pulse }]}>Opsify</Animated.Text>
    </View>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab]             = useState<Tab>('inventory');
  const [user, setUser]                       = useState<any>(null);
  const [loading, setLoading]                 = useState(true);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showNotifications, setShowNotifications]     = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isChatOpen, setIsChatOpen]           = useState(false);
  const [unreadCount, setUnreadCount]         = useState(0);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Poll for unread notification count every 60s
  const pollNotifications = useCallback(async () => {
    try {
      const notifs = await ApiService.getNotifications(50);
      setUnreadCount(notifs.filter((n: any) => !n.read).length);
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser?.email) {
        try {
          await FirebaseChatService.createUser(
            currentUser.uid,
            currentUser.displayName || currentUser.email.split('@')[0],
            currentUser.email,
          );
        } catch (err) {
          console.warn('Failed to ensure user doc:', err);
        }
        try {
          const { onboarded } = await ApiService.getOnboardingStatus();
          if (!onboarded) setNeedsOnboarding(true);
        } catch (err) {
          console.warn('[Onboarding] Status check failed, defaulting to show onboarding:', err);
          // If we can't check, show onboarding so new users always get seeded
          setNeedsOnboarding(true);
        }
        try {
          const token = await NotificationService.registerForPushNotificationsAsync();
          if (token) await ApiService.updatePushToken(token);
        } catch (err) {
          console.warn('Push registration failed:', err);
        }
        pollNotifications();
      }
    });
    return unsub;
  }, []);

  // Re-poll when notification panel closes
  useEffect(() => {
    if (!showNotifications) pollNotifications();
  }, [showNotifications]);

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setActiveTab(tab);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, ...Theme.animation.spring, useNativeDriver: true }),
      ]).start();
    });
  };

  if (loading) return <LoadingSplash />;
  if (!user)   return <AuthScreen />;

  if (needsOnboarding) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} />
      </SafeAreaView>
    );
  }

  if (showAccountSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        <AccountSettingsScreen onBack={() => setShowAccountSettings(false)} />
      </SafeAreaView>
    );
  }

  if (showNotifications) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        <NotificationsScreen onClose={() => setShowNotifications(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />

      {/* Top-right Controls */}
      <View style={styles.topControls}>
        <BellButton unreadCount={unreadCount} onPress={() => setShowNotifications(true)} />
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowAccountSettings(true)}
          activeOpacity={0.7}
        >
          <Settings size={18} color={Theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <AppDataProvider>
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <ErrorBoundary fallbackTitle="Customer Brain Error">
            {activeTab === 'customer'  && <CustomerBrainScreen />}
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="ERP Hub Error">
            {activeTab === 'inventory' && <InventoryDashboardScreen />}
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="OmniChat Error">
            {activeTab === 'omnichat' && (
              <OmniChatScreen
                currentUserId={user.uid}
              />
            )}
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="Delivery Error">
            {activeTab === 'logistics' && <DeliveryIntelligenceScreen />}
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="OpsBot Error">
            {activeTab === 'opsbot' && <ChatScreen currentUserId={user.uid} />}
          </ErrorBoundary>
          <ErrorBoundary fallbackTitle="ERP Agent Error">
            {activeTab === 'erpagent' && <ERPAgentScreen />}
          </ErrorBoundary>
        </Animated.View>
      </AppDataProvider>

      {/* Premium Floating Nav Bar */}
      <View style={styles.floatingNavContainer}>
        <BlurView intensity={50} tint="dark" style={styles.glassNav}>
          {/* Inner glow border */}
          <LinearGradient
            colors={['rgba(0,230,118,0.06)', 'rgba(0,0,0,0)', 'rgba(0,176,255,0.04)']}
            style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.pill }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />
          {TABS.map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              isActive={activeTab === id}
              onPress={() => switchTab(id)}
              icon={
                <Icon
                  size={22}
                  color={activeTab === id ? Theme.colors.primary : Theme.colors.textMuted}
                />
              }
              label={label}
            />
          ))}
        </BlurView>
      </View>

      {/* Floating OpsBot */}
      {activeTab !== 'opsbot' && activeTab !== 'omnichat' && (
        <TouchableOpacity style={styles.floatingChatButton} onPress={() => setIsChatOpen(true)} activeOpacity={0.8}>
          <Bot size={26} color={Theme.colors.background} />
        </TouchableOpacity>
      )}

      {/* OpsBot Modal */}
      <Modal visible={isChatOpen} animationType="slide" transparent onRequestClose={() => setIsChatOpen(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="dark" style={styles.modalContent}>
            <ChatScreen onClose={() => setIsChatOpen(false)} currentUserId={user?.uid} />
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  container: { flex: 1, paddingBottom: 96 },

  splashContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashRing: {
    position: 'absolute',
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  splashIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    overflow: 'hidden',
    ...Theme.shadows.glow,
  },
  splashGradient: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  splashText: {
    fontSize: 22, fontWeight: '800', color: Theme.colors.text,
    letterSpacing: -0.5,
  },

  topControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 12,
    right: 14,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Theme.colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Theme.colors.background,
  },
  bellBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  settingsBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  floatingNavContainer: {
    position: 'absolute', bottom: Theme.spacing.lg,
    left: Theme.spacing.md, right: Theme.spacing.md,
    alignItems: 'center',
    ...Theme.shadows.modal,
  },
  glassNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    width: '100%', height: 72,
    borderRadius: Theme.borderRadius.pill,
    backgroundColor: 'rgba(13,17,23,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    paddingHorizontal: 6,
  },

  navItemContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  navItem: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 6,
    borderRadius: Theme.borderRadius.pill,
    minWidth: 52, minHeight: 52,
    overflow: 'hidden',
  },
  navActivePill: {
    borderRadius: Theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
    overflow: 'hidden',
  },
  navText: {
    color: Theme.colors.textMuted,
    fontSize: 9, fontWeight: '600',
    marginTop: 3, letterSpacing: 0.2,
  },
  navTextActive: { color: Theme.colors.primary, fontWeight: '800' },
  navBadge: {
    position: 'absolute', top: 4, right: 2,
    minWidth: 15, height: 15, borderRadius: 7.5,
    backgroundColor: Theme.colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '900' },

  floatingChatButton: {
    position: 'absolute', bottom: 106, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Theme.shadows.glow,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 999,
  },
  floatingChatHideButton: {
    position: 'absolute', bottom: 113, right: 80,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(30,35,55,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.border,
    zIndex: 999,
  },
  floatingChatShowButton: {
    position: 'absolute', bottom: 106, right: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(30,35,55,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Theme.colors.primary,
    zIndex: 999,
    ...Theme.shadows.glow,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%', height: '92%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Theme.colors.border,
  },
});
