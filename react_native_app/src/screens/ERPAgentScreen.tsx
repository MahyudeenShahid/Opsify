import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Animated, TextInput, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  AlertTriangle, Search, MapPin, Plus, Trash2, Zap,
  TrendingUp, RefreshCw, ChevronDown, ChevronUp, DollarSign,
  Edit2, CheckCircle
} from 'lucide-react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { useAppData } from '../core/AppDataContext';

const URGENCY_CONFIG: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  CRITICAL: { color: '#FF2A55', bg: 'rgba(255,42,85,0.1)', label: 'CRITICAL', emoji: '🚨' },
  HIGH: { color: '#FF9100', bg: 'rgba(255,145,0,0.1)', label: 'HIGH', emoji: '⚠️' },
  MEDIUM: { color: '#FFB800', bg: 'rgba(255,184,0,0.08)', label: 'MEDIUM', emoji: '🟡' },
};

// ─── Staggered Animated Card ──────────────────────────────────────────────────
const AnimatedCard = ({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) => {
  const opacity  = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: Theme.animation.duration.normal,
        delay: index * Theme.animation.duration.stagger,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0, delay: index * Theme.animation.duration.stagger,
        ...Theme.animation.spring, useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

export const ERPAgentScreen: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [searchingFor, setSearchingFor] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<Record<number, any[]>>({});
  const [addedVendors, setAddedVendors] = useState<Set<string>>(new Set());
  const [scoutLocation, setScoutLocation] = useState('Karachi');
  const [activeSection, setActiveSection] = useState<'alerts' | 'profit' | 'suppliers' | 'warehouses'>('alerts');
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierRating, setSupplierRating] = useState('');
  const [supplierReliability, setSupplierReliability] = useState('');
  const [supplierLeadTime, setSupplierLeadTime] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  // Use global shared data — eliminates duplicate requests
  const {
    suggestions, profitSummary: profitData, suppliers, warehouses, products,
    isLoading: isContextLoading,
    refresh: refreshAll, refreshSuppliers, setSuppliers,
  } = useAppData();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    // Trigger a refresh if no data yet; context handles debounce
    refreshAll();
    // Pulse animation for scanning indicator
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const runScan = async () => {
    setIsScanning(true);
    try {
      await refreshAll(true); // force full refresh from backend
    } catch (e: any) {
      Alert.alert('Scan Error', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFindSupplier = async (item: any) => {
    setSearchingFor(item.product_id);
    try {
      const results = await ApiService.searchVendors(
        `${item.product_name} wholesaler`,
        scoutLocation
      );
      setSearchResults(prev => ({ ...prev, [item.product_id]: results }));
      setExpandedItem(item.product_id);
    } catch (e: any) {
      Alert.alert('Search Error', e.message);
    } finally {
      setSearchingFor(null);
    }
  };

  const handleAddVendorAsSupplier = async (vendor: any) => {
    try {
      await ApiService.addSupplier({
        name: vendor.name,
        contact: vendor.contact,
        rating: vendor.rating,
        reliability_score: vendor.reliability_score,
        lead_time_days: parseFloat(vendor.distance) > 3 ? 4 : 2,
      });
      setAddedVendors(prev => new Set([...prev, vendor.id]));
      await refreshSuppliers();
      Alert.alert('✅ Supplier Added', `${vendor.name} has been added to your supplier network.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteSupplier = (sup: any) => {
    const msg = `Remove "${sup.name}" from your network?`;
    if (Platform.OS === 'web') {
      if ((window as any).confirm(msg)) {
        ApiService.deleteSupplier(sup.id)
          .then(() => setSuppliers(prev => prev.filter(s => s.id !== sup.id)))
          .catch(e => (window as any).alert('Error: ' + e.message));
      }
      return;
    }
    Alert.alert(
      'Remove Supplier',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteSupplier(sup.id);
              setSuppliers(prev => prev.filter(s => s.id !== sup.id));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllSuppliers = () => {
    const msg = `This will remove all ${suppliers.length} suppliers. This cannot be undone.`;
    if (Platform.OS === 'web') {
      if ((window as any).confirm(msg)) {
        ApiService.deleteAllSuppliers()
          .then(() => setSuppliers([]))
          .catch(e => (window as any).alert('Error: ' + e.message));
      }
      return;
    }
    Alert.alert(
      'Delete All Suppliers',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All', style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteAllSuppliers();
              setSuppliers([]);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleSaveSupplier = async () => {
    let missing = [];
    if (!supplierName) missing.push("Company Name");
    if (!supplierContact) missing.push("Contact Info");
    if (!supplierRating) missing.push("Rating");
    if (!supplierReliability) missing.push("Reliability");
    if (!supplierLeadTime) missing.push("Lead Time");

    if (missing.length > 0) {
      const msg = 'Missing fields: ' + missing.join(', ');
      if (Platform.OS === 'web') (window as any).alert(msg);
      else Alert.alert('Incomplete Form', msg);
      return;
    }

    setIsSubmittingSupplier(true);
    try {
      const data = {
        name: supplierName,
        contact: supplierContact,
        rating: parseFloat(supplierRating),
        reliability_score: parseFloat(supplierReliability),
        lead_time_days: parseInt(supplierLeadTime),
      };

      if (editingSupplierId) {
        await ApiService.updateSupplier(editingSupplierId, data);
        if (Platform.OS === 'web') (window as any).alert('Supplier updated successfully.');
        else Alert.alert('Success', 'Supplier updated successfully.');
      } else {
        await ApiService.addSupplier(data);
        if (Platform.OS === 'web') (window as any).alert('Supplier added successfully.');
        else Alert.alert('Success', 'Supplier added successfully.');
      }
      
      setSupplierName(''); setSupplierContact(''); setSupplierRating(''); setSupplierReliability(''); setSupplierLeadTime('');
      setEditingSupplierId(null);
      setShowSupplierForm(false);
      
      await refreshSuppliers();
    } catch (e: any) {
      if (Platform.OS === 'web') (window as any).alert('Error: ' + e.message);
      else Alert.alert('Error', e.message);
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const handleEditSupplierPress = (sup: any) => {
    setSupplierName(sup.name || '');
    setSupplierContact(sup.contact || '');
    setSupplierRating(sup.rating?.toString() || '');
    setSupplierReliability(sup.reliability_score?.toString() || '');
    setSupplierLeadTime(sup.lead_time_days?.toString() || '');
    setEditingSupplierId(sup.id);
    setShowSupplierForm(true);
  };

  const fmt = (n: number) => {
    if (!n) return 'Rs 0';
    if (n >= 1000000) return `Rs ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `Rs ${(n / 1000).toFixed(1)}K`;
    return `Rs ${n.toFixed(0)}`;
  };

  return (
    <View style={styles.container}>
      {/* Animated Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <View>
              <View style={styles.agentBadge}>
                <Animated.View style={[styles.agentDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.agentBadgeText}>SYSTEM 2 · LIVE</Text>
              </View>
              <Text style={[styles.headerTitle, { marginTop: 8 }]}>ERP Intelligence Agent</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={runScan} disabled={isScanning}>
              {isScanning
                ? <ActivityIndicator size="small" color={Theme.colors.primary} />
                : <RefreshCw size={16} color={Theme.colors.primary} />
              }
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>Automated procurement & supplier intelligence</Text>
        </View>
      </Animated.View>

      {/* Section Toggle Pills */}
      <View style={styles.sectionToggle}>
        {([
          { id: 'alerts' as const,     label: 'Alerts',     count: suggestions.length, icon: '⚡' },
          { id: 'profit' as const,     label: 'Profit',     count: null,               icon: '💰' },
          { id: 'suppliers' as const,  label: 'Suppliers',  count: suppliers.length,   icon: '🤝' },
          { id: 'warehouses' as const, label: 'Warehouses', count: warehouses.length,  icon: '🏢' },
        ]).map(s => (
          <TouchableOpacity
            key={s.id}
            style={[styles.toggleBtn, activeSection === s.id && styles.toggleBtnActive]}
            onPress={() => setActiveSection(s.id)}
            activeOpacity={0.75}
          >
            {activeSection === s.id && (
              <LinearGradient
                colors={['rgba(0,230,118,0.2)', 'rgba(0,176,255,0.12)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
            )}
            <Text style={[styles.toggleText, activeSection === s.id && styles.toggleTextActive]} numberOfLines={1}>
              {s.icon} {s.label}{s.count !== null && s.count > 0 ? ` · ${s.count}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ─── ALERTS SECTION ──────────────────────────────── */}
        {activeSection === 'alerts' && (
          <>
            {isScanning && !suggestions.length ? (
              <View style={styles.scanningState}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.scanningText}>🔍 Scanning inventory for low stock...</Text>
              </View>
            ) : suggestions.length === 0 ? (
              <View style={styles.allClearCard}>
                <LinearGradient colors={['rgba(0,230,118,0.1)', 'rgba(0,230,118,0.03)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.allClearEmoji}>✅</Text>
                <Text style={styles.allClearTitle}>All Systems Green</Text>
                <Text style={styles.allClearSub}>All inventory levels are above their reorder thresholds.</Text>
              </View>
            ) : (
              <>
                {/* Location Picker */}
                <View style={styles.locationRow}>
                  <MapPin size={14} color={Theme.colors.primary} />
                  <Text style={styles.locationLabel}>Search Location:</Text>
                  <TextInput
                    style={styles.locationInput}
                    value={scoutLocation}
                    onChangeText={setScoutLocation}
                    placeholderTextColor={Theme.colors.textMuted}
                    placeholder="City or area"
                  />
                </View>

                {suggestions.map((item, alertIdx) => {
                  const cfg = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.MEDIUM;
                  const isExpanded = expandedItem === item.product_id;
                  const results = searchResults[item.product_id] || [];
                  const isSearching = searchingFor === item.product_id;

                  return (
                    <AnimatedCard key={item.product_id} index={alertIdx}>
                    <View style={[styles.alertCard, { borderColor: `${cfg.color}50` }]}>
                      <LinearGradient pointerEvents="none" colors={['#1F2937', '#111827']} style={StyleSheet.absoluteFill} />

                      {/* Alert Header */}
                      <View style={styles.alertTop}>
                        <View style={[styles.urgencyPill, { backgroundColor: `${cfg.color}20`, borderColor: cfg.color }]}>
                          <Text style={styles.urgencyEmoji}>{cfg.emoji}</Text>
                          <Text style={[styles.urgencyLabel, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Text style={styles.alertProductName}>{item.product_name}</Text>
                        <Text style={styles.alertWarehouse}>{item.warehouse_name}</Text>
                      </View>

                      {/* Stock Metrics */}
                      <View style={styles.metricsRow}>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>STOCK</Text>
                          <Text style={[styles.metricVal, { color: cfg.color }]}>{item.current_stock}</Text>
                        </View>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>THRESHOLD</Text>
                          <Text style={styles.metricVal}>{item.threshold}</Text>
                        </View>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>DAYS LEFT</Text>
                          <Text style={[styles.metricVal, { color: item.days_of_stock_remaining < 3 ? Theme.colors.error : Theme.colors.warning }]}>
                            {item.days_of_stock_remaining}
                          </Text>
                        </View>
                        <View style={styles.metric}>
                          <Text style={styles.metricLabel}>ORDER QTY</Text>
                          <Text style={[styles.metricVal, { color: Theme.colors.primary }]}>{item.suggested_reorder_qty}</Text>
                        </View>
                      </View>

                      <Text style={styles.alertMessage}>{item.message}</Text>

                      {/* Find Supplier Button */}
                      <TouchableOpacity
                        style={[styles.findSupplierBtn, isSearching && { opacity: 0.7 }]}
                        onPress={() => isExpanded ? setExpandedItem(null) : handleFindSupplier(item)}
                        disabled={isSearching}
                      >
                        <LinearGradient
                          colors={isExpanded ? ['rgba(255,42,85,0.2)', 'rgba(255,42,85,0.1)'] : Theme.gradients.secondary}
                          style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.sm }]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        />
                        {isSearching ? (
                          <><ActivityIndicator size="small" color={isExpanded ? Theme.colors.error : '#000'} />
                            <Text style={[styles.findBtnText, { color: '#000' }]}>Searching...</Text></>
                        ) : (
                          <><Search size={14} color={isExpanded ? Theme.colors.error : '#000'} />
                            <Text style={[styles.findBtnText, { color: isExpanded ? Theme.colors.error : '#000' }]}>
                              {isExpanded ? 'Hide Results' : `🗺 Find Nearby Supplier in ${scoutLocation}`}
                            </Text></>
                        )}
                      </TouchableOpacity>

                      {/* Vendor Results */}
                      {isExpanded && results.length > 0 && (
                        <View style={styles.vendorResults}>
                          <Text style={styles.vendorResultsTitle}>Top {results.length} Nearby Suppliers</Text>
                          {results.map((vendor, idx) => {
                            const vNorm = vendor.name.trim().toLowerCase();
                            const isAdded = addedVendors.has(vendor.id) || suppliers.some(s => s.name.trim().toLowerCase() === vNorm);
                            return (
                              <View key={vendor.id} style={styles.vendorCard}>
                                <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
                                <View style={styles.vendorHeader}>
                                  <View style={styles.vendorRank}>
                                    <Text style={styles.vendorRankText}>#{idx + 1}</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.vendorName}>{vendor.name}</Text>
                                    <Text style={styles.vendorAddress} numberOfLines={1}>📍 {vendor.address}</Text>
                                  </View>
                                </View>
                                <View style={styles.vendorBadges}>
                                  <View style={styles.vBadge}><Text style={styles.vBadgeText}>⭐ {vendor.rating?.toFixed(1)}</Text></View>
                                  <View style={[styles.vBadge, { borderColor: '#7000FF' }]}><Text style={styles.vBadgeText}>🚗 {vendor.distance}</Text></View>
                                  <View style={[styles.vBadge, { borderColor: Theme.colors.primary }]}><Text style={styles.vBadgeText}>💰 {vendor.price}</Text></View>
                                  <View style={[styles.vBadge, { borderColor: '#00B0FF' }]}><Text style={styles.vBadgeText}>📞 {vendor.contact?.slice(0, 14)}</Text></View>
                                </View>
                                <TouchableOpacity
                                  style={[styles.addVendorBtn, isAdded && styles.addedVendorBtn]}
                                  onPress={() => !isAdded && handleAddVendorAsSupplier(vendor)}
                                  disabled={isAdded}
                                >
                                  <LinearGradient
                                    colors={isAdded ? ['rgba(0,230,118,0.15)', 'rgba(0,230,118,0.05)'] : Theme.gradients.primary}
                                    style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.sm }]}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                  />
                                  <Plus size={14} color={isAdded ? Theme.colors.primary : '#000'} />
                                  <Text style={[styles.addVendorText, { color: isAdded ? Theme.colors.primary : '#000' }]}>
                                    {isAdded ? '✅ Added to Supplier List' : 'Add to Supplier List'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                    </AnimatedCard>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ─── PROFIT SECTION ──────────────────────────────── */}
        {activeSection === 'profit' && (
          <View>
            {!profitData ? (
              <View style={styles.scanningState}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.scanningText}>Loading profit analytics...</Text>
              </View>
            ) : (
              <>
                {/* KPI Row */}
                <View style={styles.kpiRow}>
                  {[
                    { label: 'TOTAL REVENUE', value: fmt(profitData.total_revenue), color: Theme.colors.primary },
                    { label: 'TOTAL PROFIT', value: fmt(profitData.total_profit), color: profitData.total_profit >= 0 ? '#00FFA3' : Theme.colors.error },
                    { label: 'MARGIN', value: `${profitData.total_margin_pct?.toFixed(1)}%`, color: Theme.colors.secondary },
                    { label: 'LOW STOCK', value: `${profitData.low_stock_count}`, color: profitData.low_stock_count > 0 ? Theme.colors.error : Theme.colors.primary },
                  ].map((kpi, i) => (
                    <View key={i} style={styles.kpiCard}>
                      <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
                      <Text style={styles.kpiLabel}>{kpi.label}</Text>
                      <Text style={[styles.kpiVal, { color: kpi.color }]}>{kpi.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Per-Product Profit */}
                <Text style={styles.sectionTitle}>Product Profitability</Text>
                {(profitData.per_product || []).map((p: any, i: number) => (
                  <View key={p.product_id} style={styles.profitCard}>
                    <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
                    <View style={styles.profitCardTop}>
                      <Text style={styles.profitProductName}>{p.product_name}</Text>
                      <View style={[styles.marginBadge, { borderColor: p.margin_pct >= 20 ? Theme.colors.primary : Theme.colors.warning, backgroundColor: p.margin_pct >= 20 ? 'rgba(0,230,118,0.1)' : 'rgba(255,145,0,0.1)' }]}>
                        <Text style={[styles.marginBadgeText, { color: p.margin_pct >= 20 ? Theme.colors.primary : Theme.colors.warning }]}>
                          {p.margin_pct.toFixed(1)}% margin
                        </Text>
                      </View>
                    </View>
                    <View style={styles.profitStats}>
                      <View style={styles.pStat}><Text style={styles.pStatLabel}>REVENUE</Text><Text style={[styles.pStatVal, { color: Theme.colors.primary }]}>{fmt(p.revenue)}</Text></View>
                      <View style={styles.pStat}><Text style={styles.pStatLabel}>COST</Text><Text style={[styles.pStatVal, { color: Theme.colors.error }]}>{fmt(p.cost)}</Text></View>
                      <View style={styles.pStat}><Text style={styles.pStatLabel}>PROFIT</Text><Text style={[styles.pStatVal, { color: '#00FFA3' }]}>{fmt(p.profit)}</Text></View>
                      <View style={styles.pStat}><Text style={styles.pStatLabel}>SOLD</Text><Text style={styles.pStatVal}>{p.qty_sold}</Text></View>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min(p.margin_pct, 100)}%`, backgroundColor: p.margin_pct >= 20 ? Theme.colors.primary : Theme.colors.warning }]} />
                    </View>
                  </View>
                ))}
                {(!profitData.per_product || profitData.per_product.length === 0) && (
                  <View style={styles.emptyState}>
                    <DollarSign size={40} color={Theme.colors.textMuted} />
                    <Text style={styles.emptyText}>No sales recorded yet. Record some sales to see profit analytics.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ─── SUPPLIERS SECTION ───────────────────────────── */}
        {activeSection === 'suppliers' && (
          <View>
            <View style={styles.supplierHeader}>
              <Text style={styles.sectionTitle}>Supplier Network ({suppliers.length})</Text>
              {suppliers.length > 0 && (
                <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAllSuppliers}>
                  <Trash2 size={13} color={Theme.colors.error} />
                  <Text style={styles.deleteAllText}>Delete All</Text>
                </TouchableOpacity>
              )}
            </View>

            {suppliers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🤝</Text>
                <Text style={styles.emptyText}>No suppliers yet. Find suppliers in the Alerts section and add them here.</Text>
              </View>
            )}

            {/* Add/Edit Manual Form Toggle */}
            <TouchableOpacity style={{ height: 48, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Theme.spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onPress={() => { setEditingSupplierId(null); setShowSupplierForm(!showSupplierForm); }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                {showSupplierForm ? 'Cancel Manual Entry' : '+ Add Supplier Manually'}
              </Text>
            </TouchableOpacity>

            {/* Premium Manual Entry Form */}
            {showSupplierForm && (
              <View style={{ marginBottom: Theme.spacing.lg }}>
                {/* Outer Glow / Border Wrap */}
                <View style={{ 
                  borderRadius: 20, 
                  padding: 2, 
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  shadowColor: '#00FFA3',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 10,
                }}>
                  <LinearGradient pointerEvents="none" colors={['rgba(0, 255, 163, 0.3)', 'rgba(0, 176, 255, 0.1)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
                  
                  {/* Inner Form Card */}
                  <View style={{ 
                    backgroundColor: 'rgba(17, 22, 34, 0.95)', 
                    borderRadius: 18, 
                    padding: 24,
                    overflow: 'hidden',
                  }}>
                    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFill} />
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0, 255, 163, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                          {editingSupplierId ? <Edit2 size={16} color="#00FFA3" /> : <Plus size={16} color="#00FFA3" />}
                        </View>
                        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>
                          {editingSupplierId ? 'Update Supplier' : 'New Supplier'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowSupplierForm(false)} style={{ padding: 4 }}>
                        <Text style={{ color: Theme.colors.textMuted, fontSize: 20, fontWeight: '300' }}>×</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Form Fields */}
                    <View style={{ gap: 16 }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>COMPANY PROFILE</Text>
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, height: 50, justifyContent: 'center' }}>
                          <TextInput 
                            style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }} 
                            placeholder="Supplier Name (e.g. Acme Corp)" 
                            placeholderTextColor="rgba(255,255,255,0.2)" 
                            value={supplierName} 
                            onChangeText={setSupplierName} 
                          />
                        </View>
                      </View>

                      <View>
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, height: 50, justifyContent: 'center' }}>
                          <TextInput 
                            style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }} 
                            placeholder="Contact Number or Email" 
                            placeholderTextColor="rgba(255,255,255,0.2)" 
                            value={supplierContact} 
                            onChangeText={setSupplierContact} 
                          />
                        </View>
                      </View>

                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 8, marginLeft: 4 }}>PERFORMANCE METRICS</Text>
                      
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, height: 50, justifyContent: 'center' }}>
                          <TextInput 
                            style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }} 
                            placeholder="Rating (1-5)" 
                            placeholderTextColor="rgba(255,255,255,0.2)" 
                            keyboardType="numeric" 
                            value={supplierRating} 
                            onChangeText={setSupplierRating} 
                          />
                        </View>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, height: 50, justifyContent: 'center' }}>
                          <TextInput 
                            style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }} 
                            placeholder="Reliability %" 
                            placeholderTextColor="rgba(255,255,255,0.2)" 
                            keyboardType="numeric" 
                            value={supplierReliability} 
                            onChangeText={setSupplierReliability} 
                          />
                        </View>
                      </View>

                      <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, height: 50, justifyContent: 'center' }}>
                        <TextInput 
                          style={{ color: '#FFF', fontSize: 15, fontWeight: '500' }} 
                          placeholder="Lead Time (e.g. 3 Days)" 
                          placeholderTextColor="rgba(255,255,255,0.2)" 
                          keyboardType="numeric" 
                          value={supplierLeadTime} 
                          onChangeText={setSupplierLeadTime} 
                        />
                      </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity 
                      style={{ 
                        height: 54, 
                        borderRadius: 14, 
                        marginTop: 28, 
                        overflow: 'hidden',
                        justifyContent: 'center', 
                        alignItems: 'center',
                        shadowColor: '#00FFA3',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 5,
                      }} 
                      onPress={handleSaveSupplier} 
                      disabled={isSubmittingSupplier}
                    >
                      <LinearGradient pointerEvents="none" colors={['#00FFA3', '#00E676']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                      {isSubmittingSupplier ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {editingSupplierId ? <CheckCircle size={18} color="#000" /> : <Plus size={18} color="#000" />}
                          <Text style={{ color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                            {editingSupplierId ? 'SAVE CHANGES' : 'ADD SUPPLIER'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {suppliers.map((sup) => (
              <View key={sup.id} style={styles.supplierCard}>
                <LinearGradient pointerEvents="none" colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
                <View style={styles.supplierCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.supplierName}>{sup.name}</Text>
                    <Text style={styles.supplierContact}>{sup.contact}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.ratingPill}>
                      <Text style={styles.ratingPillText}>⭐ {sup.rating?.toFixed(1)}</Text>
                    </View>
                    <TouchableOpacity style={styles.deleteSupBtn} onPress={() => handleEditSupplierPress(sup)}>
                      <Text style={{ fontSize: 12 }}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteSupBtn} onPress={() => handleDeleteSupplier(sup)}>
                      <Trash2 size={14} color={Theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.supplierStats}>
                  <View style={styles.supStat}>
                    <Text style={styles.supStatLabel}>RELIABILITY</Text>
                    <Text style={[styles.supStatVal, { color: sup.reliability_score >= 90 ? Theme.colors.primary : Theme.colors.warning }]}>{sup.reliability_score}%</Text>
                  </View>
                  <View style={styles.supStat}>
                    <Text style={styles.supStatLabel}>LEAD TIME</Text>
                    <Text style={styles.supStatVal}>{sup.lead_time_days} Days</Text>
                  </View>
                  <View style={styles.supStat}>
                    <Text style={styles.supStatLabel}>ID</Text>
                    <Text style={styles.supStatVal}>#{sup.id}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── WAREHOUSES SECTION ───────────────────────────── */}
        {activeSection === 'warehouses' && (
          <View>
            <View style={styles.supplierHeader}>
              <Text style={styles.sectionTitle}>Warehouse Locations ({warehouses.length})</Text>
            </View>

            {warehouses.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏢</Text>
                <Text style={styles.emptyText}>No warehouses configured.</Text>
              </View>
            )}

            {warehouses.map((wh) => {
              // Find products in this warehouse
              const whProducts = products.filter(p => String(p.warehouse_id) === String(wh.id));
              
              return (
                <View key={wh.id} style={styles.supplierCard}>
                <LinearGradient pointerEvents="none" colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
                  
                  <View style={styles.supplierCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.supplierName}>{wh.name}</Text>
                      <Text style={styles.supplierContact}>📍 {wh.location || 'Unknown Location'}</Text>
                    </View>
                    <View style={styles.ratingPill}>
                      <Text style={styles.ratingPillText}>WH #{wh.id}</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 }}>
                    <Text style={{ color: Theme.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 }}>
                      STOCKED PRODUCTS ({whProducts.length})
                    </Text>

                    {whProducts.length === 0 ? (
                      <Text style={{ color: Theme.colors.textMuted, fontSize: 11, fontStyle: 'italic' }}>
                        No stock currently recorded in this location.
                      </Text>
                    ) : (
                      whProducts.map((p, pIdx) => {
                        const isLowStock = parseFloat(p.stock) <= parseFloat(p.reorder_threshold);
                        return (
                          <View key={`${wh.id}-${p.id || p.sku}-${pIdx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: pIdx < whProducts.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{p.name}</Text>
                              <Text style={{ color: Theme.colors.textMuted, fontSize: 10 }}>Variant: {p.variant || 'N/A'} · SKU: {p.sku || 'N/A'}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ color: isLowStock ? Theme.colors.error : Theme.colors.primary, fontSize: 13, fontWeight: '900' }}>
                                {p.stock} {p.unit || 'units'}
                              </Text>
                              <Text style={{ color: Theme.colors.textMuted, fontSize: 9 }}>
                                Min: {p.reorder_threshold}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: { paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  agentBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  agentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.primary },
  agentBadgeText: { color: Theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 4 },

  sectionToggle: { flexDirection: 'row', gap: 8, paddingHorizontal: Theme.spacing.md, marginBottom: Theme.spacing.md },
  toggleBtn: { flex: 1, height: 36, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  toggleBtnActive: { backgroundColor: 'rgba(0,230,118,0.12)', borderColor: Theme.colors.primary },
  toggleText: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  toggleTextActive: { color: Theme.colors.primary, fontWeight: '900' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.xxl * 2 },

  scanningState: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  scanningText: { color: Theme.colors.textMuted, fontSize: 14 },

  allClearCard: { borderRadius: Theme.borderRadius.xl, borderWidth: 1.5, borderColor: Theme.colors.primary, padding: Theme.spacing.xl, alignItems: 'center', overflow: 'hidden', ...Theme.shadows.glass },
  allClearEmoji: { fontSize: 48, marginBottom: 12 },
  allClearTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  allClearSub: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center' },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, paddingHorizontal: Theme.spacing.md, height: 44, marginBottom: Theme.spacing.md },
  locationLabel: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  locationInput: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '700' },

  alertCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  alertTop: { marginBottom: Theme.spacing.sm },
  urgencyPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, borderWidth: 1, marginBottom: 6 },
  urgencyEmoji: { fontSize: 12 },
  urgencyLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  alertProductName: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  alertWarehouse: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.sm },
  metric: {},
  metricLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  metricVal: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 2 },
  alertMessage: { color: Theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: Theme.spacing.sm },
  findSupplierBtn: { height: 44, borderRadius: Theme.borderRadius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  findBtnText: { fontSize: 13, fontWeight: '800' },

  vendorResults: { marginTop: Theme.spacing.md },
  vendorResultsTitle: { color: Theme.colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginBottom: Theme.spacing.sm },
  vendorCard: { borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm, overflow: 'hidden' },
  vendorHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Theme.spacing.sm },
  vendorRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 1, borderColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  vendorRankText: { color: Theme.colors.primary, fontSize: 11, fontWeight: '900' },
  vendorName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  vendorAddress: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  vendorBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Theme.spacing.sm },
  vBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, borderWidth: 1, borderColor: '#FFB800', backgroundColor: 'rgba(255,184,0,0.1)' },
  vBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  addVendorBtn: { height: 38, borderRadius: Theme.borderRadius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  addedVendorBtn: { borderWidth: 1, borderColor: Theme.colors.primary },
  addVendorText: { fontSize: 12, fontWeight: '800' },

  // Profit section
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Theme.spacing.lg },
  kpiCard: { width: '48%', borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, overflow: 'hidden' },
  kpiLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  kpiVal: { fontSize: 20, fontWeight: '900' },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: Theme.spacing.md },
  profitCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm, overflow: 'hidden' },
  profitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  profitProductName: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  marginBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  marginBadgeText: { fontSize: 11, fontWeight: '800' },
  profitStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pStat: {},
  pStatLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  pStatVal: { color: '#FFF', fontSize: 15, fontWeight: '900', marginTop: 2 },
  barTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  // Suppliers section
  supplierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
  deleteAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Theme.borderRadius.sm, backgroundColor: 'rgba(255,42,85,0.1)', borderWidth: 1, borderColor: 'rgba(255,42,85,0.4)' },
  deleteAllText: { color: Theme.colors.error, fontSize: 11, fontWeight: '800' },
  supplierCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm, overflow: 'hidden' },
  supplierCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Theme.spacing.sm },
  supplierName: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  supplierContact: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  ratingPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,184,0,0.1)', borderWidth: 1, borderColor: '#FFB800' },
  ratingPillText: { color: '#FFB800', fontSize: 11, fontWeight: '800' },
  deleteSupBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,42,85,0.08)', borderWidth: 1, borderColor: 'rgba(255,42,85,0.3)', alignItems: 'center', justifyContent: 'center' },
  supplierStats: { flexDirection: 'row', gap: 16 },
  supStat: {},
  supStatLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  supStatVal: { color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 2 },
});
