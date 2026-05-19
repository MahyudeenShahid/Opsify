import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, StatusBar, StyleSheet, Text, View,
  TouchableOpacity, Animated, Easing, Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { BrainCircuit, Boxes, MessageCircle, Navigation, Bot, TrendingUp, Settings, Eye, EyeOff } from 'lucide-react-native';

import { Theme } from './src/core/theme';
import { CustomerBrainScreen } from './src/screens/CustomerBrainScreen';
import { InventoryDashboardScreen } from './src/screens/InventoryDashboardScreen';
import { OmniChatScreen } from './src/screens/OmniChat/OmniChatScreen';
import { DeliveryIntelligenceScreen } from './src/screens/DeliveryIntelligenceScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ERPAgentScreen } from './src/screens/ERPAgentScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { auth } from './src/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { FirebaseChatService } from './src/services/firebaseChatService';
import { ApiService } from './src/services/api';

type Tab = 'customer' | 'inventory' | 'omnichat' | 'logistics' | 'opsbot' | 'erpagent';

const NavButton = ({
  isActive, onPress, icon, label, badge,
}: {
  isActive: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
      style={styles.navItemContainer}
    >
      <Animated.View style={[styles.navItem, isActive && styles.navItemActive, { transform: [{ scale }] }]}>
        {icon}
        <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
        {badge != null && badge > 0 && (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFloatingBotHidden, setIsFloatingBotHidden] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
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
        // Check onboarding
        try {
          const { onboarded } = await ApiService.getOnboardingStatus();
          if (!onboarded) setNeedsOnboarding(true);
        } catch {
          // If backend unreachable, skip onboarding check
        }
      }
    });
    return unsubscribe;
  }, []);

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setActiveTab(tab);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
      ]).start();
    });
  };

  // Loading splash
  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={{ opacity: 0.5 }}>
          <BrainCircuit color={Theme.colors.primary} size={48} />
        </Animated.View>
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  // Onboarding — shown once for new users
  if (needsOnboarding) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} />
      </SafeAreaView>
    );
  }

  // Account Settings overlay
  if (showAccountSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
        <AccountSettingsScreen onBack={() => setShowAccountSettings(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />

      {/* Account Settings gear */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => setShowAccountSettings(true)}
      >
        <Settings size={18} color={Theme.colors.textMuted} />
      </TouchableOpacity>

      {/* Main Content */}
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <ErrorBoundary fallbackTitle="Customer Brain Error">
          {activeTab === 'customer' && <CustomerBrainScreen />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="ERP Hub Error">
          {activeTab === 'inventory' && <InventoryDashboardScreen />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="OmniChat Error">
          {activeTab === 'omnichat' && <OmniChatScreen currentUserId={user.uid} />}
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

      {/* Floating Glassmorphic Nav Bar */}
      <View style={styles.floatingNavContainer}>
        <BlurView intensity={40} tint="dark" style={styles.glassNav}>
          <NavButton
            isActive={activeTab === 'customer'}
            onPress={() => switchTab('customer')}
            icon={<BrainCircuit size={22} color={activeTab === 'customer' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Brain"
          />
          <NavButton
            isActive={activeTab === 'inventory'}
            onPress={() => switchTab('inventory')}
            icon={<Boxes size={22} color={activeTab === 'inventory' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="ERP Hub"
          />
          <NavButton
            isActive={activeTab === 'omnichat'}
            onPress={() => switchTab('omnichat')}
            icon={<MessageCircle size={22} color={activeTab === 'omnichat' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="OmniChat"
          />
          <NavButton
            isActive={activeTab === 'logistics'}
            onPress={() => switchTab('logistics')}
            icon={<Navigation size={22} color={activeTab === 'logistics' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Delivery"
          />
          <NavButton
            isActive={activeTab === 'opsbot'}
            onPress={() => switchTab('opsbot')}
            icon={<Bot size={22} color={activeTab === 'opsbot' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="OpsBot"
          />
          <NavButton
            isActive={activeTab === 'erpagent'}
            onPress={() => switchTab('erpagent')}
            icon={<TrendingUp size={22} color={activeTab === 'erpagent' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Agent"
          />
        </BlurView>
      </View>

      {/* Floating Chatbot Overlay / Button */}
      {activeTab !== 'opsbot' && (
        <>
          {activeTab === 'omnichat' ? (
            !isFloatingBotHidden ? (
              <>
                <TouchableOpacity
                  style={styles.floatingChatButton}
                  onPress={() => setIsChatOpen(true)}
                  activeOpacity={0.8}
                >
                  <Bot size={26} color={Theme.colors.background} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.floatingChatHideButton}
                  onPress={() => setIsFloatingBotHidden(true)}
                  activeOpacity={0.8}
                >
                  <EyeOff size={16} color={Theme.colors.textMuted} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.floatingChatShowButton}
                onPress={() => setIsFloatingBotHidden(false)}
                activeOpacity={0.8}
              >
                <Eye size={18} color={Theme.colors.primary} />
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={styles.floatingChatButton}
              onPress={() => setIsChatOpen(true)}
              activeOpacity={0.8}
            >
              <Bot size={26} color={Theme.colors.background} />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Floating Chatbot Modal Overlay */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChatOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="dark" style={styles.modalContent}>
            <ChatScreen onClose={() => setIsChatOpen(false)} currentUserId={user?.uid} />
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  container: { flex: 1, paddingBottom: 90 },

  settingsBtn: {
    position: 'absolute',
    top: 54,
    right: 16,
    zIndex: 100,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  floatingNavContainer: {
    position: 'absolute', bottom: Theme.spacing.lg,
    left: Theme.spacing.md, right: Theme.spacing.md,
    alignItems: 'center', justifyContent: 'center',
    ...Theme.shadows.glass,
  },
  glassNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    width: '100%', height: 72, borderRadius: Theme.borderRadius.pill,
    backgroundColor: Theme.colors.glass, borderWidth: 1, borderColor: Theme.colors.border,
    overflow: 'hidden', paddingHorizontal: Theme.spacing.sm,
  },

  navItemContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navItem: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Theme.spacing.sm, paddingHorizontal: 6,
    borderRadius: Theme.borderRadius.pill,
  },
  navItemActive: { backgroundColor: Theme.colors.primaryGlow },
  navText: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '600', marginTop: 3 },
  navTextActive: { color: Theme.colors.primary, fontWeight: 'bold' },

  navBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Theme.colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  floatingChatButton: {
    position: 'absolute',
    bottom: 105,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 999,
  },
  floatingChatHideButton: {
    position: 'absolute',
    bottom: 111,
    right: 80,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 35, 55, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    zIndex: 999,
  },
  floatingChatShowButton: {
    position: 'absolute',
    bottom: 105,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 35, 55, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    zIndex: 999,
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
});
