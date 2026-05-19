import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, TouchableOpacity, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { BrainCircuit, Boxes, MessageCircle, Navigation } from 'lucide-react-native';

import { Theme } from './src/core/theme';
import { CustomerBrainScreen } from './src/screens/CustomerBrainScreen';
import { InventoryDashboardScreen } from './src/screens/InventoryDashboardScreen';
import { OmniChatScreen } from './src/screens/OmniChat/OmniChatScreen';
import { LogisticsScreen } from './src/screens/LogisticsScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { auth } from './src/config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

type Tab = 'customer' | 'inventory' | 'omnichat' | 'logistics';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleDemoLogin = () => {
    setUser({
      uid: 'demo-user-id',
      email: 'demo@opsify.com',
      displayName: 'Demo Manager'
    });
  };

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
    return <AuthScreen onDemoLogin={handleDemoLogin} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {/* Main Screen Content with Transitions */}
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {activeTab === 'customer' && <CustomerBrainScreen />}
        {activeTab === 'inventory' && <InventoryDashboardScreen />}
        {activeTab === 'omnichat' && <OmniChatScreen currentUserId={user.uid} />}
        {activeTab === 'logistics' && <LogisticsScreen />}
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
        </BlurView>
      </View>
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
  }
});
