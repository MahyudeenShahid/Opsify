import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, TouchableOpacity, Animated, Easing, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { BrainCircuit, Boxes, MessageCircle, Navigation, Bot, TrendingUp } from 'lucide-react-native';

import { Theme } from './src/core/theme';
import { CustomerBrainScreen } from './src/screens/CustomerBrainScreen';
import { InventoryDashboardScreen } from './src/screens/InventoryDashboardScreen';
import { OmniChatScreen } from './src/screens/OmniChat/OmniChatScreen';
import { LogisticsScreen } from './src/screens/LogisticsScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ERPAgentScreen } from './src/screens/ERPAgentScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { auth } from './src/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { FirebaseChatService } from './src/services/firebaseChatService';

type Tab = 'customer' | 'inventory' | 'omnichat' | 'logistics' | 'opsbot' | 'erpagent';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Animation values
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Ensure a Firestore user document exists for every authenticated user.
      if (currentUser && currentUser.email) {
        (async () => {
          try {
            await FirebaseChatService.createUser(
              currentUser.uid,
              currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
              currentUser.email
            );
          } catch (err) {
            // Don't block UI on failure; log for diagnostics.
            // eslint-disable-next-line no-console
            console.warn('Failed to ensure user doc on sign-in:', err);
          }
        })();
      }
    });
    return unsubscribe;
  }, []);

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true })
    ]).start(() => {
      setActiveTab(tab);
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true })
      ]).start();
    });
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={{ opacity: 0.5 }}>
          <BrainCircuit color={Theme.colors.primary} size={48} />
        </Animated.View>
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {/* Main Screen Content with Transitions */}
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <ErrorBoundary fallbackTitle="Customer Brain Error">
          {activeTab === 'customer' && <CustomerBrainScreen />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="Ledger Error">
          {activeTab === 'inventory' && <InventoryDashboardScreen />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="OmniChat Error">
          {activeTab === 'omnichat' && <OmniChatScreen currentUserId={user.uid} />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="Dispatch Error">
          {activeTab === 'logistics' && <LogisticsScreen />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="OpsBot Error">
          {activeTab === 'opsbot' && <ChatScreen currentUserId={user.uid} />}
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="ERP Agent Error">
          {activeTab === 'erpagent' && <ERPAgentScreen />}
        </ErrorBoundary>
      </Animated.View>

      {/* Floating Glassmorphic Tab Navigation Bar */}
      <View style={styles.floatingNavContainer}>
        <BlurView intensity={40} tint="dark" style={styles.glassNav}>
          <NavButton 
            isActive={activeTab === 'customer'} 
            onPress={() => switchTab('customer')}
            icon={<BrainCircuit size={24} color={activeTab === 'customer' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Brain"
          />
          <NavButton 
            isActive={activeTab === 'inventory'} 
            onPress={() => switchTab('inventory')}
            icon={<Boxes size={24} color={activeTab === 'inventory' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Ledger"
          />
          <NavButton 
            isActive={activeTab === 'omnichat'} 
            onPress={() => switchTab('omnichat')}
            icon={<MessageCircle size={24} color={activeTab === 'omnichat' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="OmniChat"
          />
          <NavButton 
            isActive={activeTab === 'logistics'} 
            onPress={() => switchTab('logistics')}
            icon={<Navigation size={24} color={activeTab === 'logistics' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Dispatch"
          />
          <NavButton 
            isActive={activeTab === 'opsbot'} 
            onPress={() => switchTab('opsbot')}
            icon={<Bot size={24} color={activeTab === 'opsbot' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="OpsBot"
          />
          <NavButton 
            isActive={activeTab === 'erpagent'} 
            onPress={() => switchTab('erpagent')}
            icon={<TrendingUp size={24} color={activeTab === 'erpagent' ? Theme.colors.primary : Theme.colors.textMuted} />}
            label="Agent"
          />
        </BlurView>
      </View>
      {/* Floating Chatbot Button */}
      <TouchableOpacity 
        style={styles.floatingChatButton} 
        onPress={() => setIsChatOpen(true)}
        activeOpacity={0.8}
      >
        <Bot size={28} color={Theme.colors.background} />
      </TouchableOpacity>

      {/* Floating Chatbot Modal Overlay */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChatOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="dark" style={styles.modalContent}>
            <ChatScreen onClose={() => setIsChatOpen(false)} currentUserId={user.uid} />
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const NavButton = ({ isActive, onPress, icon, label }: { isActive: boolean, onPress: () => void, icon: React.ReactNode, label: string }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity 
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.navItemContainer}
    >
      <Animated.View style={[styles.navItem, isActive && styles.navItemActive, { transform: [{ scale }] }]}>
        {icon}
        <Text style={[styles.navText, isActive && styles.navTextActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    flex: 1,
    paddingBottom: 90, // space for floating nav
  },
  floatingNavContainer: {
    position: 'absolute',
    bottom: Theme.spacing.lg,
    left: Theme.spacing.md,
    right: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.glass,
  },
  glassNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    height: 72,
    borderRadius: Theme.borderRadius.pill,
    backgroundColor: Theme.colors.glass,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
    paddingHorizontal: Theme.spacing.sm,
  },
  navItemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.pill,
  },
  navItemActive: {
    backgroundColor: Theme.colors.primaryGlow,
  },
  navText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  navTextActive: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 110,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
