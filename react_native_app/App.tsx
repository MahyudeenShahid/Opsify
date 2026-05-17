import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { CustomerBrainScreen } from './src/screens/CustomerBrainScreen';
import { InventoryDashboardScreen } from './src/screens/InventoryDashboardScreen';
import { Theme } from './src/core/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'inventory'>('customer');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.colors.background} />
      
      {/* Main Screen Content */}
      <View style={styles.container}>
        {activeTab === 'customer' ? <CustomerBrainScreen /> : <InventoryDashboardScreen />}
      </View>

      {/* Sleek Custom Glassmorphic Tab Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'customer' && styles.activeTabItem]}
          onPress={() => setActiveTab('customer')}
        >
          <Text style={[styles.tabText, activeTab === 'customer' ? styles.activeTabText : styles.inactiveTabText]}>
            🧠 Customer Brain
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'inventory' && styles.activeTabItem]}
          onPress={() => setActiveTab('inventory')}
        >
          <Text style={[styles.tabText, activeTab === 'inventory' ? styles.activeTabText : styles.inactiveTabText]}>
            📦 Inventory Hub
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#161926',
    borderTopWidth: 1.5,
    borderTopColor: Theme.colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 5,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  activeTabItem: {
    borderTopWidth: 2.5,
    borderTopColor: Theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: Theme.colors.primary,
  },
  inactiveTabText: {
    color: Theme.colors.textMuted,
  },
});
