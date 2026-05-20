import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, Animated, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2, Trash } from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

const { width } = Dimensions.get('window');

export const SupplierManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'scout'>('directory');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Manual Supplier Form State
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [rating, setRating] = useState('');
  const [reliability, setReliability] = useState('');
  const [leadTime, setLeadTime] = useState('');

  // Map Scout State
  const [scoutQuery, setScoutQuery] = useState('Milk Wholesaler');
  const [scoutLocation, setScoutLocation] = useState('Clifton');
  const [scoutResults, setScoutResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scoutSuccessId, setScoutSuccessId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const handleNearMePress = () => {
    setIsFetchingLocation(true);
    const geo = (navigator as any).geolocation;
    if (!geo) {
      Alert.alert('Not Supported', 'Geolocation is not supported by your browser/device.');
      setIsFetchingLocation(false);
      return;
    }
    
    geo.getCurrentPosition(
      async (position: any) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setScoutLocation('Locating...');
        
        // Reverse geocode completely for free using OSM Nominatim!
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`, {
            headers: { 'User-Agent': 'OpsifyERP/1.0' }
          });
          const data = await res.json();
          const address = data.address || {};
          const localArea = address.suburb || address.neighbourhood || address.quarter || address.city_district || address.suburb || address.city || 'Near Me';
          setScoutLocation(localArea);
        } catch (err) {
          setScoutLocation('Near Me');
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error: any) => {
        setIsFetchingLocation(false);
        Alert.alert('Location Error', 'Unable to fetch your GPS coordinates. Using Clifton as fallback.');
        setScoutLocation('Clifton');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Animated Hooks
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const notifyScale = useRef(new Animated.Value(0)).current;
  const notifyOpacity = useRef(new Animated.Value(0)).current;

  const fetchSuppliers = async () => {
    try {
      const data = await ApiService.getSuppliers();
      setSuppliers(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const switchTab = (tab: 'directory' | 'scout') => {
    if (tab === activeTab) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleAddSupplier = async () => {
    if (!name || !contact || !rating || !reliability || !leadTime) {
      const msg = 'Please satisfy all operational metrics before onboarding.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Incomplete Form', msg);
      return;
    }

    try {
      await ApiService.addSupplier({
        name,
        contact,
        rating: parseFloat(rating),
        reliability_score: parseFloat(reliability),
        lead_time_days: parseInt(leadTime),
      });
      setName(''); setContact(''); setRating(''); setReliability(''); setLeadTime('');
      setShowAddForm(false);
      fetchSuppliers();
      const sMsg = 'The distributor has been successfully cataloged.';
      if (Platform.OS === 'web') (window as any).alert('Supplier Onboarded: ' + sMsg);
      else Alert.alert('Supplier Onboarded', sMsg);
    } catch (e: any) {
      if (Platform.OS === 'web') (window as any).alert('Registry Error: ' + e.message);
      else Alert.alert('Registry Error', e.message);
    }
  };

  const startSatelliteScan = async () => {
    setIsScanning(true);
    setScanComplete(false);
    setScoutResults([]);
    
    // Animate notification out if open
    Animated.parallel([
      Animated.timing(notifyScale, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(notifyOpacity, { toValue: 0, duration: 100, useNativeDriver: true })
    ]).start();

    try {
      const results = await ApiService.searchVendors(scoutQuery, scoutLocation);
      
      // Simulate real-world satellite telemetry delay for luxury UX
      setTimeout(() => {
        setScoutResults(results);
        setIsScanning(false);
        setScanComplete(true);
        
        // Luxury notification entrance
        Animated.parallel([
          Animated.spring(notifyScale, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true
          }),
          Animated.timing(notifyOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true
          })
        ]).start();
      }, 1800);
    } catch (e: any) {
      setIsScanning(false);
      Alert.alert('Satellite Error', 'Failed to trace coordinate networks.');
    }
  };

  const onboardScoutedSupplier = async (vendor: any) => {
    try {
      await ApiService.addSupplier({
        name: vendor.name,
        contact: vendor.contact,
        rating: vendor.rating,
        reliability_score: vendor.reliability_score,
        lead_time_days: parseInt(vendor.distance) > 3 ? 4 : 2, // dynamic calculation based on distance
      });
      
      setScoutSuccessId(vendor.id);
      fetchSuppliers();
      
      setTimeout(() => {
        setScoutSuccessId(null);
        Alert.alert('Onboarding Complete', `${vendor.name} has been certified and added to dynamic restock bidding!`);
      }, 1000);
    } catch (e: any) {
      Alert.alert('Onboarding Failed', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      {/* Luxury Segmented Control */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={styles.tabButton} onPress={() => switchTab('directory')}>
          {activeTab === 'directory' && (
            <LinearGradient colors={Theme.gradients.primary} style={StyleSheet.absoluteFill} start={{x: 0, y: 0}} end={{x: 1, y: 0}} />
          )}
          <Text style={[styles.tabButtonText, activeTab === 'directory' && styles.activeTabText]}>
            🤝 Directory ({suppliers.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabButton} onPress={() => switchTab('scout')}>
          {activeTab === 'scout' && (
            <LinearGradient colors={Theme.gradients.primary} style={StyleSheet.absoluteFill} start={{x: 0, y: 0}} end={{x: 1, y: 0}} />
          )}
          <Text style={[styles.tabButtonText, activeTab === 'scout' && styles.activeTabText]}>
            📡 Maps Wholesaler Scout
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        {activeTab === 'directory' ? (
          // ================= DIRECTORY TAB =================
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Supplier Network</Text>
                <Text style={styles.sectionSubtitle}>Active Wholesalers tied to dynamic inventory bidding.</Text>
              </View>
              {suppliers.length > 0 && (
                <TouchableOpacity
                  style={styles.deleteAllBtn}
                  onPress={() => {
                    const msg = `This will permanently delete all ${suppliers.length} suppliers. Continue?`;
                    if (Platform.OS === 'web') {
                      if ((window as any).confirm(msg)) {
                        ApiService.deleteAllSuppliers()
                          .then(() => { fetchSuppliers(); (window as any).alert('Done: All suppliers removed.'); })
                          .catch((e: any) => (window as any).alert('Error: ' + e.message));
                      }
                      return;
                    }
                    Alert.alert(
                      'Delete All Suppliers',
                      msg,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete All',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await ApiService.deleteAllSuppliers();
                              fetchSuppliers();
                              Alert.alert('Done', 'All suppliers removed.');
                            } catch (e: any) {
                              Alert.alert('Error', e.message);
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Trash size={14} color={Theme.colors.error} />
                  <Text style={styles.deleteAllText}>Delete All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Add Manual Form Toggle */}
            <TouchableOpacity style={{ height: 48, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Theme.spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onPress={() => setShowAddForm(!showAddForm)}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                {showAddForm ? 'Cancel Manual Entry' : '+ Add Supplier Manually'}
              </Text>
            </TouchableOpacity>

            {showAddForm && (
              <View style={{ borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' }}>
                <LinearGradient pointerEvents="none" colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md }}>✍️ Manual Supplier Entry</Text>
                
                <TextInput style={styles.input} placeholder="Company Name *" placeholderTextColor={Theme.colors.textMuted} value={name} onChangeText={setName} />
                <TextInput style={styles.input} placeholder="Contact Info *" placeholderTextColor={Theme.colors.textMuted} value={contact} onChangeText={setContact} />
                
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput style={styles.input} placeholder="Rating (1-5) *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={rating} onChangeText={setRating} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput style={styles.input} placeholder="Reliability % *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={reliability} onChangeText={setReliability} />
                  </View>
                </View>
                
                <TextInput style={styles.input} placeholder="Lead Time (Days) *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={leadTime} onChangeText={setLeadTime} />

                <TouchableOpacity style={{ height: 48, borderRadius: Theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: 8 }} onPress={handleAddSupplier}>
                  <LinearGradient colors={Theme.gradients.secondary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                  <Text style={{ color: '#000', fontSize: 14, fontWeight: '900' }}>Save Supplier</Text>
                </TouchableOpacity>
              </View>
            )}

            {suppliers.map((sup) => (
              <View key={sup.id} style={styles.luxuryCard}>
                <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />
                
                <View style={styles.cardHeader}>
                  <Text style={styles.supplierName}>{sup.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>⭐ {sup.rating.toFixed(1)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteSupplierBtn}
                      onPress={() => {
                        const msg = `Remove "${sup.name}" from the network?`;
                        if (Platform.OS === 'web') {
                          if ((window as any).confirm(msg)) {
                            ApiService.deleteSupplier(sup.id)
                              .then(() => fetchSuppliers())
                              .catch((e: any) => (window as any).alert('Error: ' + e.message));
                          }
                          return;
                        }
                        Alert.alert(
                          'Delete Supplier',
                          msg,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await ApiService.deleteSupplier(sup.id);
                                  fetchSuppliers();
                                } catch (e: any) {
                                  Alert.alert('Error', e.message);
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Trash2 size={14} color={Theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.dividerLine} />
                
                <View style={styles.cardDetailRow}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>RELIABILITY</Text>
                    <Text style={[styles.detailValue, { color: sup.reliability_score >= 90 ? Theme.colors.success : Theme.colors.warning }]}>
                      {sup.reliability_score}%
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>LEAD TIME</Text>
                    <Text style={styles.detailValue}>{sup.lead_time_days} Days</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>CONTACT</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>{sup.contact}</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Manual Onboarding Form */}
            <View style={[styles.luxuryCard, { marginTop: Theme.spacing.lg }]}>
              <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />
              
              <Text style={styles.formTitle}>✨ Onboard Custom Partner</Text>
              <Text style={styles.formSubtitle}>Manually certify a wholesaler into the SQLite system ledger.</Text>
              
              <TextInput style={styles.luxuryInput} placeholder="Company Legal Name" placeholderTextColor={Theme.colors.textMuted} value={name} onChangeText={setName} />
              <TextInput style={styles.luxuryInput} placeholder="Contact Email or Phone Number" placeholderTextColor={Theme.colors.textMuted} value={contact} onChangeText={setContact} />
              
              <View style={styles.inputRow}>
                <TextInput style={[styles.luxuryInput, { flex: 1, marginRight: Theme.spacing.sm }]} placeholder="Rating (1.0-5.0)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={rating} onChangeText={setRating} />
                <TextInput style={[styles.luxuryInput, { flex: 1, marginLeft: Theme.spacing.sm }]} placeholder="Reliability Score (%)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={reliability} onChangeText={setReliability} />
              </View>
              
              <TextInput style={styles.luxuryInput} placeholder="Lead Time Buffer (Days)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={leadTime} onChangeText={setLeadTime} />
              
              <TouchableOpacity style={styles.luxuryButton} onPress={handleAddSupplier}>
                <LinearGradient colors={Theme.gradients.secondary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} />
                <Text style={styles.buttonText}>Certify Wholesaler</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // ================= MAPS SCOUT TAB =================
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Wholesaler Scout</Text>
              <Text style={styles.sectionSubtitle}>Query active commercial networks and select suppliers to onboard.</Text>
            </View>

            {/* Search Panel */}
            <View style={styles.searchCard}>
              <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />
              
              <View style={styles.inputLabelGroup}>
                <Text style={styles.inputLabel}>WHOLESALE COMMODITY</Text>
                <TextInput style={styles.scoutInput} placeholder="e.g. Milk Wholesaler, Copper Wire" placeholderTextColor={Theme.colors.textMuted} value={scoutQuery} onChangeText={setScoutQuery} />
              </View>

              <View style={styles.inputLabelGroup}>
                <Text style={styles.inputLabel}>TARGET SEARCH GEOGRAPHY (REGION)</Text>
                <View style={styles.chipsRow}>
                  {['Clifton', 'DHA', 'Gulshan'].map((loc) => (
                    <TouchableOpacity key={loc} style={[styles.chipButton, scoutLocation === loc && styles.activeChip]} onPress={() => { setScoutLocation(loc); setUserLocation(null); }}>
                      <Text style={[styles.chipText, scoutLocation === loc && styles.activeChipText]}>
                        📍 {loc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    style={[
                      styles.chipButton, 
                      (scoutLocation !== 'Clifton' && scoutLocation !== 'DHA' && scoutLocation !== 'Gulshan') && styles.activeChip
                    ]} 
                    onPress={handleNearMePress}
                    disabled={isFetchingLocation}
                  >
                    {isFetchingLocation ? (
                      <ActivityIndicator size="small" color="#00FFB0" style={{ marginHorizontal: 12 }} />
                    ) : (
                      <Text style={[
                        styles.chipText, 
                        (scoutLocation !== 'Clifton' && scoutLocation !== 'DHA' && scoutLocation !== 'Gulshan') && styles.activeChipText
                      ]}>
                        🎯 Near Me {scoutLocation !== 'Clifton' && scoutLocation !== 'DHA' && scoutLocation !== 'Gulshan' && scoutLocation !== 'Locating...' ? `(${scoutLocation})` : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={[styles.scoutSearchButton, isScanning && styles.disabledButton]} onPress={startSatelliteScan} disabled={isScanning}>
                <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} />
                {isScanning ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#000" style={{ marginRight: 10 }} />
                    <Text style={[styles.buttonText, { color: '#000' }]}>📡 CALIBRATING SATELLITES...</Text>
                  </View>
                ) : (
                  <Text style={[styles.buttonText, { color: '#000' }]}>🔍 LAUNCH RADAR SEARCH</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Scan Notification Alert */}
            {scanComplete && (
              <Animated.View style={[styles.notifyBanner, { opacity: notifyOpacity, transform: [{ scale: notifyScale }] }]}>
                <LinearGradient colors={['rgba(0, 255, 163, 0.15)', 'rgba(0, 240, 255, 0.05)']} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} />
                <Text style={styles.notifyBannerText}>
                  ✨ **SATELLITE RADAR SUCCESS**: Found exactly **{scoutResults.length} verified Wholesalers** in "{scoutLocation}" matching "{scoutQuery}"! Choose the best option to onboard.
                </Text>
              </Animated.View>
            )}

            {/* Vendor Cards List */}
            {scoutResults.map((vendor, idx) => {
              const isAdded = scoutSuccessId === vendor.id;
              return (
                <View key={vendor.id} style={styles.vendorCard}>
                  <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />
                  
                  <View style={styles.vendorIndexContainer}>
                    <Text style={styles.vendorIndexText}>OPTION #{idx + 1}</Text>
                  </View>

                  <View style={styles.cardHeader}>
                    <Text style={styles.scoutedName}>{vendor.name}</Text>
                  </View>
                  
                  <Text style={styles.vendorAddress}>📍 {vendor.address}</Text>
                  
                  <View style={styles.scoutBadgesRow}>
                    <View style={[styles.scoutBadge, styles.ratingColor]}>
                      <Text style={styles.scoutBadgeText}>⭐ {vendor.rating.toFixed(1)} Rating</Text>
                    </View>
                    <View style={[styles.scoutBadge, styles.distanceColor]}>
                      <Text style={styles.scoutBadgeText}>🚗 {vendor.distance}</Text>
                    </View>
                    <View style={[styles.scoutBadge, styles.priceColor]}>
                      <Text style={styles.scoutBadgeText}>🏷️ {vendor.price}</Text>
                    </View>
                  </View>

                  <View style={styles.dividerLine} />

                  <View style={styles.vendorMetricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Reliability Score</Text>
                      <Text style={styles.metricVal}>{vendor.reliability_score}%</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Contact Line</Text>
                      <Text style={styles.metricVal}>{vendor.contact}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.onboardButton, isAdded && styles.successButton]} onPress={() => onboardScoutedSupplier(vendor)}>
                    <LinearGradient colors={isAdded ? Theme.gradients.success : Theme.gradients.secondary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} />
                    <Text style={styles.onboardButtonText}>
                      {isAdded ? '✅ CERTIFIED & CONNECTED' : '⚡ CHOOSE & ONBOARD SUPPLIER'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { paddingBottom: Theme.spacing.xl, paddingHorizontal: Theme.spacing.sm },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#FFF',
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: Theme.borderRadius.pill, padding: 4, marginBottom: Theme.spacing.md, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.1)' },
  tabButton: { flex: 1, height: 44, borderRadius: Theme.borderRadius.pill, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  tabButtonText: { color: Theme.colors.textMuted, fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  activeTabText: { color: '#000', fontWeight: '900' },
  tabContent: { marginTop: Theme.spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Theme.spacing.md, paddingHorizontal: Theme.spacing.xs },
  sectionTitle: { color: Theme.colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  sectionSubtitle: { color: Theme.colors.textMuted, fontSize: 13, marginTop: 4 },
  deleteAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Theme.borderRadius.sm, backgroundColor: 'rgba(255,42,85,0.1)', borderWidth: 1, borderColor: 'rgba(255,42,85,0.4)' },
  deleteAllText: { color: Theme.colors.error, fontSize: 11, fontWeight: '800' },
  deleteSupplierBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,42,85,0.08)', borderWidth: 1, borderColor: 'rgba(255,42,85,0.3)', alignItems: 'center', justifyContent: 'center' },
  
  // Luxury Directory CSS
  luxuryCard: { position: 'relative', borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  supplierName: { color: Theme.colors.text, fontSize: 17, fontWeight: '800' },
  ratingBadge: { paddingHorizontal: Theme.spacing.sm, paddingVertical: 4, borderRadius: Theme.borderRadius.sm, backgroundColor: 'rgba(255, 184, 0, 0.15)', borderWidth: 1, borderColor: '#FFB800' },
  ratingText: { color: '#FFB800', fontWeight: '800', fontSize: 12 },
  dividerLine: { height: 1.5, backgroundColor: Theme.colors.border, marginVertical: Theme.spacing.sm, zIndex: 1 },
  cardDetailRow: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 1 },
  detailCol: { flex: 1 },
  detailLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { color: Theme.colors.text, fontSize: 14, fontWeight: '800' },

  // Manual Form CSS
  formTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', zIndex: 1 },
  formSubtitle: { color: Theme.colors.textMuted, fontSize: 12, marginBottom: Theme.spacing.md, zIndex: 1 },
  luxuryInput: { height: 44, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: Theme.colors.text, fontSize: 14, marginBottom: Theme.spacing.sm, zIndex: 1 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 1 },
  luxuryButton: { height: 46, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: Theme.spacing.sm, overflow: 'hidden', zIndex: 1 },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  // Scout CSS
  searchCard: { position: 'relative', borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  inputLabelGroup: { marginBottom: Theme.spacing.md, zIndex: 1 },
  inputLabel: { color: Theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: Theme.spacing.sm },
  scoutInput: { height: 44, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: Theme.colors.text, fontSize: 14 },
  chipsRow: { flexDirection: 'row' },
  chipButton: { paddingHorizontal: Theme.spacing.md, height: 38, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255, 255, 255, 0.04)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: Theme.spacing.sm },
  activeChip: { backgroundColor: 'rgba(0, 240, 255, 0.1)', borderColor: Theme.colors.primary },
  chipText: { color: Theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  activeChipText: { color: Theme.colors.primary },
  scoutSearchButton: { height: 46, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', zIndex: 1 },
  disabledButton: { opacity: 0.8 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },

  // Notification Banner CSS
  notifyBanner: { position: 'relative', padding: Theme.spacing.md, borderRadius: Theme.borderRadius.md, borderWidth: 1.5, borderColor: Theme.colors.success, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  notifyBannerText: { color: Theme.colors.text, fontSize: 13, fontWeight: '700', zIndex: 1, lineHeight: 18 },

  // Vendor Card CSS
  vendorCard: { position: 'relative', borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  vendorIndexContainer: { alignSelf: 'flex-start', paddingHorizontal: Theme.spacing.sm, paddingVertical: 2, borderRadius: Theme.borderRadius.sm, backgroundColor: 'rgba(112, 0, 255, 0.15)', borderWidth: 1, borderColor: Theme.colors.secondary, marginBottom: Theme.spacing.xs, zIndex: 1 },
  vendorIndexText: { fontSize: 9, fontWeight: '900', color: '#9D5BFF', letterSpacing: 0.5 },
  scoutedName: { color: Theme.colors.text, fontSize: 16, fontWeight: '800', zIndex: 1 },
  vendorAddress: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: Theme.spacing.sm, zIndex: 1 },
  scoutBadgesRow: { flexDirection: 'row', zIndex: 1 },
  scoutBadge: { paddingHorizontal: Theme.spacing.sm, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, borderWidth: 1, marginRight: Theme.spacing.xs },
  ratingColor: { backgroundColor: 'rgba(255, 184, 0, 0.1)', borderColor: '#FFB800' },
  distanceColor: { backgroundColor: 'rgba(112, 0, 255, 0.1)', borderColor: '#7000FF' },
  priceColor: { backgroundColor: 'rgba(0, 255, 163, 0.1)', borderColor: '#00FFA3' },
  scoutBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  vendorMetricsRow: { flexDirection: 'row', zIndex: 1 },
  metricItem: { flex: 1 },
  metricLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricVal: { color: Theme.colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  onboardButton: { height: 42, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: Theme.spacing.md, overflow: 'hidden', zIndex: 1 },
  successButton: { borderColor: Theme.colors.success, borderWidth: 1.5 },
  onboardButtonText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }
});
