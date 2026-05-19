import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, ActivityIndicator, Alert, Dimensions,
  Platform, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Navigation, Truck, CheckCircle, Clock, Radio, Package,
  MapPin, Zap, RefreshCw, ChevronRight, User, Phone,
} from 'lucide-react-native';
import Svg, { Circle, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

const { width } = Dimensions.get('window');

const JOB_STATES = ['DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'JOB_STARTED', 'JOB_COMPLETED'];

const STATE_META: Record<string, { icon: any; color: string; label: string }> = {
  DISPATCHED: { icon: Radio, color: '#7000FF', label: 'Rider Dispatched' },
  EN_ROUTE: { icon: Truck, color: '#00F0FF', label: 'En Route' },
  ARRIVED: { icon: MapPin, color: '#FFB800', label: 'Arrived On-Site' },
  JOB_STARTED: { icon: Zap, color: '#FF6B35', label: 'Job In Progress' },
  JOB_COMPLETED: { icon: CheckCircle, color: '#00FFA3', label: 'Completed ✓' },
};

const ZONE_PRESETS = ['Gulshan', 'Clifton', 'DHA', 'Saddar', 'PECHS', 'Nazimabad'];

// ─── Job State Machine Visualiser ───────────────────────────────────────────
const StatePipeline: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
  const currentIdx = JOB_STATES.indexOf(currentStatus);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentIdx / (JOB_STATES.length - 1),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [currentIdx]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={pipeline.container}>
      {/* Progress Track */}
      <View style={pipeline.track}>
        <Animated.View style={[pipeline.fill, { width: progressWidth }]}>
          <LinearGradient colors={['#7000FF', '#00F0FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      {/* State Nodes */}
      <View style={pipeline.nodesRow}>
        {JOB_STATES.map((state, idx) => {
          const meta = STATE_META[state];
          const IconComp = meta.icon;
          const isComplete = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <View key={state} style={pipeline.node}>
              <View style={[pipeline.nodeCircle, isComplete && { borderColor: meta.color, backgroundColor: `${meta.color}22` }, isCurrent && pipeline.currentNode]}>
                <IconComp size={14} color={isComplete ? meta.color : Theme.colors.textMuted} />
              </View>
              <Text style={[pipeline.nodeLabel, isComplete && { color: meta.color }]} numberOfLines={1}>
                {meta.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const pipeline = StyleSheet.create({
  container: { paddingVertical: Theme.spacing.md },
  track: { height: 3, backgroundColor: Theme.colors.border, marginHorizontal: Theme.spacing.xl, borderRadius: 9999, overflow: 'hidden', marginBottom: -1.5 },
  fill: { height: '100%', borderRadius: 9999, overflow: 'hidden' },
  nodesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Theme.spacing.sm },
  node: { alignItems: 'center', flex: 1 },
  nodeCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: Theme.colors.border, backgroundColor: Theme.colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  currentNode: { shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  nodeLabel: { fontSize: 8.5, fontWeight: '700', color: Theme.colors.textMuted, textAlign: 'center', letterSpacing: 0.2 },
});

// ─── Rider Geolocation MiniMap ──────────────────────────────────────────────
const RiderMiniMap: React.FC<{ job: any }> = ({ job }) => {
  const [mapMode, setMapMode] = useState<'vector' | 'google' | 'osm'>(Platform.OS === 'web' ? 'osm' : 'vector');
  const route = job.route || {};
  const origin = route.origin || { lat: 24.8138, lng: 67.0366 };
  const dest = route.destination || { lat: 24.8155, lng: 67.0327 };

  const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';

  // Calculate scaling factors so the route coordinates fit perfectly inside the SVG box
  const minLat = Math.min(origin.lat, dest.lat) - 0.005;
  const maxLat = Math.max(origin.lat, dest.lat) + 0.005;
  const minLng = Math.min(origin.lng, dest.lng) - 0.005;
  const maxLng = Math.max(origin.lng, dest.lng) + 0.005;

  const mapX = (lng: number) => {
    const range = maxLng - minLng;
    return range === 0 ? 150 : 30 + ((lng - minLng) / range) * 240;
  };
  const mapY = (lat: number) => {
    const range = maxLat - minLat;
    return range === 0 ? 60 : 100 - ((lat - minLat) / range) * 80;
  };

  const x1 = mapX(origin.lng);
  const y1 = mapY(origin.lat);
  const x2 = mapX(dest.lng);
  const y2 = mapY(dest.lat);

  // Compute animated progress along the path based on job lifecycle status
  let progress = 0;
  if (job.status === 'EN_ROUTE') progress = 0.5;
  else if (['ARRIVED', 'JOB_STARTED', 'JOB_COMPLETED'].includes(job.status)) progress = 1.0;

  const rx = x1 + (x2 - x1) * progress;
  const ry = y1 + (y2 - y1) * progress;

  const openNativeMap = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
    Linking.openURL(url).catch(err => console.error("Failed to open maps", err));
  };

  const getMapUrl = () => {
    const w = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
    const host = Platform.OS === 'web' ? (w ? w.location.hostname : 'localhost') : 'localhost';
    return `http://${host}:8000/api/map/render?lat1=${origin.lat}&lng1=${origin.lng}&lat2=${dest.lat}&lng2=${dest.lng}`;
  };

  return (
    <View style={styles.mapWrapper}>
      <View style={styles.mapHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.mapLabel}>🛰️ GEOLOCATION COMMAND</Text>
          {Platform.OS === 'web' && (
            <View style={styles.mapToggleContainer}>
              <TouchableOpacity
                style={[styles.mapToggleBtn, mapMode === 'osm' && styles.mapToggleBtnActive]}
                onPress={() => setMapMode('osm')}
              >
                <Text style={[styles.mapToggleText, mapMode === 'osm' && styles.mapToggleTextActive]}>OSM Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapToggleBtn, mapMode === 'google' && styles.mapToggleBtnActive]}
                onPress={() => setMapMode('google')}
              >
                <Text style={[styles.mapToggleText, mapMode === 'google' && styles.mapToggleTextActive]}>Google Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mapToggleBtn, mapMode === 'vector' && styles.mapToggleBtnActive]}
                onPress={() => setMapMode('vector')}
              >
                <Text style={[styles.mapToggleText, mapMode === 'vector' && styles.mapToggleTextActive]}>Vector Grid</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Text style={styles.mapSubLabel}>
          {mapMode === 'google' ? 'Google Embed' : mapMode === 'osm' ? 'OSM Interactive' : (route.source || 'Haversine Engine')}
        </Text>
      </View>

      {mapMode === 'osm' && Platform.OS === 'web' ? (
        <View style={{ height: 220, width: '100%', overflow: 'hidden', borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border }}>
          <iframe
            style={{
              border: 0,
              backgroundColor: '#070A0E',
              width: '100%',
              height: 220,
            }}
            loading="lazy"
            src={getMapUrl()}
          />
        </View>
      ) : mapMode === 'google' && Platform.OS === 'web' ? (
        <View style={{ height: 220, width: '100%', overflow: 'hidden' }}>
          {MAPS_KEY ? (
            <iframe
              style={{
                border: 0,
                backgroundColor: '#0A0B10',
                width: '100%',
                height: 220
              }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/directions?key=${MAPS_KEY}&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&mode=driving`}
            />
          ) : (
            <View style={[styles.mapCanvas, { height: 220, justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
              <Text style={{ color: Theme.colors.error, fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>Google Map Key Missing</Text>
              <Text style={{ color: Theme.colors.textMuted, fontSize: 11, textAlign: 'center' }}>
                Please set EXPO_PUBLIC_FIREBASE_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your env file to load real-time Google Maps.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.mapCanvas}>
          <Svg width="100%" height={110} viewBox="0 0 300 120">
            {/* Cyber grid background */}
            <Rect x="0" y="0" width="300" height="120" rx={Theme.borderRadius.md} fill="#0A0B10" />
            <Line x1="50" y1="0" x2="50" y2="120" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
            <Line x1="100" y1="0" x2="100" y2="120" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
            <Line x1="150" y1="0" x2="150" y2="120" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
            <Line x1="200" y1="0" x2="200" y2="120" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
            <Line x1="250" y1="0" x2="250" y2="120" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />

            <Line x1="0" y1="30" x2="300" y2="30" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
            <Line x1="0" y1="60" x2="300" y2="60" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />
            <Line x1="0" y1="90" x2="300" y2="90" stroke="rgba(0,240,255,0.03)" strokeWidth="1" />

            {/* Route path line */}
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={Theme.colors.primary}
              strokeWidth="2.5"
              strokeDasharray="4,4"
            />

            {/* Origin Depot Marker */}
            <Circle cx={x1} cy={y1} r="7" fill={Theme.colors.secondary} opacity={0.3} />
            <Circle cx={x1} cy={y1} r="4" fill={Theme.colors.secondary} />
            <SvgText x={x1 - 15} y={y1 - 10} fill={Theme.colors.secondary} fontSize="8" fontWeight="bold">DEPOT</SvgText>

            {/* Destination Customer Marker */}
            <Circle cx={x2} cy={y2} r="9" fill={Theme.colors.success} opacity={0.2} />
            <Circle cx={x2} cy={y2} r="5" fill={Theme.colors.success} />
            <SvgText x={x2 - 15} y={y2 + 16} fill={Theme.colors.success} fontSize="8" fontWeight="bold">CLIENT</SvgText>

            {/* Pulsing Active Rider Vehicle */}
            <G>
              <Circle cx={rx} cy={ry} r="8" fill={Theme.colors.warning} opacity={0.4} />
              <Circle cx={rx} cy={ry} r="5" fill={Theme.colors.warning} />
              <SvgText x={rx - 12} y={ry - 8} fill={Theme.colors.warning} fontSize="7" fontWeight="bold">RIDER</SvgText>
            </G>
          </Svg>

          {Platform.OS !== 'web' && (
            <TouchableOpacity style={styles.nativeMapBtn} onPress={openNativeMap}>
              <Text style={styles.nativeMapBtnText}>🗺️ Open Live Google Maps Navigation</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Job Card ────────────────────────────────────────────────────────────────
const JobCard: React.FC<{
  job: any;
  onAdvance: () => void;
  isAdvancing: boolean;
  petrolPrice?: number;
  surchargePerKm?: number;
}> = ({ job, onAdvance, isAdvancing, petrolPrice = 409.78, surchargePerKm = 27.32 }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const meta = STATE_META[job.status] || STATE_META['DISPATCHED'];
  const StatusIcon = meta.icon;
  const isCompleted = job.status === 'JOB_COMPLETED';
  const route = job.route || {};

  return (
    <Animated.View style={[styles.jobCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />

      {/* Header */}
      <View style={styles.jobHeader}>
        <View style={styles.jobIdBlock}>
          <Text style={styles.jobIdLabel}>JOB ID</Text>
          <Text style={styles.jobIdText}>{job.job_id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${meta.color}20`, borderColor: meta.color }]}>
          <StatusIcon size={11} color={meta.color} />
          <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* State Pipeline */}
      <StatePipeline currentStatus={job.status} />

      {/* Geolocation Map Rendering */}
      <RiderMiniMap job={job} />

      {/* Route Intelligence */}
      <View style={styles.routeCard}>
        <LinearGradient colors={['rgba(112,0,255,0.08)', 'rgba(0,240,255,0.05)']} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} />
        <View style={styles.routeRow}>
          <View style={styles.routeStat}>
            <Navigation size={14} color={Theme.colors.primary} />
            <Text style={styles.routeStatLabel}>DISTANCE</Text>
            <Text style={styles.routeStatValue}>{route.distance_km ?? '—'} km</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeStat}>
            <Clock size={14} color={Theme.colors.warning} />
            <Text style={styles.routeStatLabel}>ETA</Text>
            <Text style={styles.routeStatValue}>{route.eta_minutes ? `${Math.ceil(route.eta_minutes)} min` : '—'}</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeStat}>
            <Radio size={14} color={Theme.colors.success} />
            <Text style={styles.routeStatLabel}>ENGINE</Text>
            <Text style={[styles.routeStatValue, { fontSize: 9 }]}>{route.source ? (route.source.includes('OSRM') ? 'OSRM' : 'Haversine') : '—'}</Text>
          </View>
        </View>
      </View>

      {/* Dynamic Petrol Pricing Engine */}
      <View style={{
        marginTop: 12,
        backgroundColor: 'rgba(255, 196, 0, 0.05)',
        borderColor: 'rgba(255, 196, 0, 0.15)',
        borderWidth: 1,
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <View>
          <Text style={{ color: Theme.colors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
            ⛽ DYNAMIC FUEL SURCHARGE (API SOURCED)
          </Text>
          <Text style={{ color: Theme.colors.textMuted, fontSize: 10, marginTop: 1 }}>
            Index: Rs {petrolPrice.toFixed(2)}/L Petrol • Cost: Rs {surchargePerKm.toFixed(2)}/km
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: Theme.colors.primary, fontSize: 15, fontWeight: '900' }}>
            Rs {Math.round(50 + (parseFloat(route.distance_km || 0) * surchargePerKm))}
          </Text>
          <Text style={{ color: Theme.colors.textMuted, fontSize: 8, fontWeight: '700' }}>
            TOTAL DELIVERY PRICE
          </Text>
        </View>
      </View>

      {/* Rider Info */}
      <View style={styles.riderRow}>
        <View style={styles.riderInfo}>
          <User size={14} color={Theme.colors.textMuted} />
          <Text style={styles.riderText}>{job.rider_name}</Text>
          <Text style={styles.riderVehicle}>• {job.rider_vehicle}</Text>
        </View>
        <View style={styles.riderInfo}>
          <Phone size={14} color={Theme.colors.textMuted} />
          <Text style={styles.riderText}>{job.rider_phone}</Text>
        </View>
      </View>

      {/* Item & Destination */}
      <View style={styles.orderMetaRow}>
        <View style={styles.orderMetaItem}>
          <Text style={styles.orderMetaLabel}>ITEM</Text>
          <Text style={styles.orderMetaValue}>{job.item}</Text>
        </View>
        <View style={styles.orderMetaItem}>
          <Text style={styles.orderMetaLabel}>DESTINATION</Text>
          <Text style={styles.orderMetaValue}>{job.destination_zone}</Text>
        </View>
        <View style={styles.orderMetaItem}>
          <Text style={styles.orderMetaLabel}>CUSTOMER</Text>
          <Text style={styles.orderMetaValue} numberOfLines={1}>{job.customer_name}</Text>
        </View>
      </View>

      {/* Advance Button */}
      {!isCompleted && (
        <TouchableOpacity
          style={styles.advanceBtn}
          onPress={onAdvance}
          disabled={isAdvancing}
        >
          <LinearGradient
            colors={Theme.gradients.primary}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]}
          />
          {isAdvancing
            ? <ActivityIndicator size="small" color="#000" />
            : <>
              <Text style={styles.advanceBtnText}>ADVANCE STATE</Text>
              <ChevronRight size={16} color="#000" />
            </>
          }
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const LogisticsScreen: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [advancingJobId, setAdvancingJobId] = useState<string | null>(null);

  const [petrolPrice, setPetrolPrice] = useState(409.78);
  const [surchargePerKm, setSurchargePerKm] = useState(27.32);

  useEffect(() => {
    const fetchPetrol = async () => {
      try {
        const w = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
        const host = Platform.OS === 'web' ? (w ? w.location.hostname : 'localhost') : 'localhost';
        const response = await fetch(`http://${host}:8000/api/petrol/price`);
        const data = await response.json();
        if (data.petrol_price) {
          setPetrolPrice(data.petrol_price);
          setSurchargePerKm(data.surcharge_per_km);
        }
      } catch (e) {
        console.error("Failed to fetch live petrol price", e);
      }
    };
    fetchPetrol();
  }, []);

  // Dispatch form state
  const [orderId, setOrderId] = useState(`ORD-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [destination, setDestination] = useState('Clifton');
  const [item, setItem] = useState('Milk');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerY, { toValue: 0, friction: 6, useNativeDriver: true }),
    ]).start();
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsRefreshing(true);
    try {
      const data = await ApiService.listJobs();
      setJobs(data.reverse()); // latest first
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDispatch = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      Alert.alert('Missing Fields', 'Please enter customer name and phone number.');
      return;
    }
    setIsDispatching(true);
    try {
      const result = await ApiService.dispatchJob({
        order_id: orderId,
        destination,
        item,
        customer_name: customerName,
        customer_phone: customerPhone,
      });
      const job = result.job;
      const route = job.route;
      Alert.alert(
        '⚡ Job Dispatched!',
        `Rider: ${job.rider_name}\nVehicle: ${job.rider_vehicle}\nETA: ${Math.ceil(route.eta_minutes)} min (${route.distance_km} km)\nEngine: ${route.source}`,
      );
      setOrderId(`ORD-${Math.floor(Math.random() * 9000 + 1000)}`);
      setCustomerName('');
      setCustomerPhone('');
      fetchJobs();
    } catch (e: any) {
      Alert.alert('Dispatch Error', e.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleAdvance = async (jobId: string) => {
    setAdvancingJobId(jobId);
    try {
      const updated = await ApiService.advanceJob(jobId);
      setJobs(prev => prev.map(j => j.job_id === jobId ? updated : j));
    } catch (e: any) {
      Alert.alert('State Error', e.message);
    } finally {
      setAdvancingJobId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
        <View style={styles.headerTitle}>
          <Navigation color={Theme.colors.primary} size={26} />
          <Text style={styles.title}>Logistics Command</Text>
        </View>
        <Text style={styles.subtitle}>System 3 — Live Geo-Routing Engine</Text>
        <View style={styles.engineBadgeRow}>
          <View style={styles.engineBadge}>
            <Text style={styles.engineBadgeText}>🛰️ OSRM Road Network</Text>
          </View>
          <View style={[styles.engineBadge, { borderColor: Theme.colors.secondary }]}>
            <Text style={[styles.engineBadgeText, { color: Theme.colors.secondary }]}>📐 Haversine Fallback</Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Dispatch Console ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Dispatch Console</Text>
          <View style={styles.dispatchCard}>
            <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ORDER ID</Text>
              <TextInput style={styles.formInput} value={orderId} onChangeText={setOrderId} placeholderTextColor={Theme.colors.textMuted} />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>DESTINATION ZONE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Theme.spacing.xs }}>
                <View style={styles.zoneChipsRow}>
                  {ZONE_PRESETS.map((zone) => (
                    <TouchableOpacity key={zone} style={[styles.zoneChip, destination === zone && styles.activeZoneChip]} onPress={() => setDestination(zone)}>
                      <Text style={[styles.zoneChipText, destination === zone && styles.activeZoneChipText]}>📍 {zone}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ITEM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Theme.spacing.xs }}>
                <View style={styles.zoneChipsRow}>
                  {['Milk', 'Wire', 'Pipe', 'Bread', 'General'].map((i) => (
                    <TouchableOpacity key={i} style={[styles.zoneChip, item === i && { ...styles.activeZoneChip, borderColor: Theme.colors.secondary, backgroundColor: 'rgba(112,0,255,0.1)' }]} onPress={() => setItem(i)}>
                      <Text style={[styles.zoneChipText, item === i && { color: Theme.colors.secondary }]}>📦 {i}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: Theme.spacing.sm }}>
                <Text style={styles.formLabel}>CUSTOMER NAME</Text>
                <TextInput style={styles.formInput} placeholder="e.g. Ali Hassan" placeholderTextColor={Theme.colors.textMuted} value={customerName} onChangeText={setCustomerName} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>PHONE</Text>
                <TextInput style={styles.formInput} placeholder="+92-300-..." placeholderTextColor={Theme.colors.textMuted} value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
              </View>
            </View>

            <TouchableOpacity style={[styles.dispatchBtn, isDispatching && { opacity: 0.8 }]} onPress={handleDispatch} disabled={isDispatching}>
              <LinearGradient colors={Theme.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} />
              {isDispatching
                ? <ActivityIndicator color="#000" />
                : <>
                  <Zap size={16} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.dispatchBtnText}>CALCULATE ROUTE & DISPATCH</Text>
                </>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Active Jobs ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📡 Live Job Tracker</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchJobs} disabled={isRefreshing}>
              {isRefreshing
                ? <ActivityIndicator size="small" color={Theme.colors.primary} />
                : <RefreshCw size={16} color={Theme.colors.primary} />
              }
            </TouchableOpacity>
          </View>

          {jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Package size={44} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No active dispatch jobs.</Text>
              <Text style={styles.emptySubText}>Use the console above to create your first dispatch.</Text>
            </View>
          ) : (
            jobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                onAdvance={() => handleAdvance(job.job_id)}
                isAdvancing={advancingJobId === job.job_id}
                petrolPrice={petrolPrice}
                surchargePerKm={surchargePerKm}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: { paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.md },
  headerTitle: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: Theme.colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginLeft: 10 },
  subtitle: { color: Theme.colors.primary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginLeft: 36 },
  engineBadgeRow: { flexDirection: 'row', marginLeft: 36, marginTop: Theme.spacing.sm, gap: 8 },
  engineBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, borderWidth: 1, borderColor: Theme.colors.primary, backgroundColor: 'rgba(0,240,255,0.08)' },
  engineBadgeText: { fontSize: 10, fontWeight: '700', color: Theme.colors.primary },
  scrollContent: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.xxl * 2 },

  section: { marginBottom: Theme.spacing.lg },
  sectionTitle: { color: Theme.colors.text, fontSize: 17, fontWeight: '800', marginBottom: Theme.spacing.md, letterSpacing: -0.3 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
  refreshBtn: { width: 36, height: 36, borderRadius: Theme.borderRadius.pill, backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  // Dispatch Form
  dispatchCard: { position: 'relative', borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  formGroup: { marginBottom: Theme.spacing.md },
  formLabel: { color: Theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  formInput: { height: 44, backgroundColor: Theme.colors.background, borderWidth: 1.5, borderColor: Theme.colors.border, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: Theme.colors.text, fontSize: 14, marginTop: 4 },
  inputRow: { flexDirection: 'row', marginBottom: Theme.spacing.md },
  zoneChipsRow: { flexDirection: 'row', gap: 8 },
  zoneChip: { paddingHorizontal: 12, height: 36, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  activeZoneChip: { backgroundColor: 'rgba(0,240,255,0.1)', borderColor: Theme.colors.primary },
  zoneChipText: { color: Theme.colors.textMuted, fontSize: 13, fontWeight: '700' },
  activeZoneChipText: { color: Theme.colors.primary },
  dispatchBtn: { height: 48, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dispatchBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: Theme.spacing.xxl, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.xl, borderWidth: 1, borderColor: Theme.colors.border, borderStyle: 'dashed' },
  emptyText: { color: Theme.colors.text, marginTop: 12, fontSize: 15, fontWeight: '700' },
  emptySubText: { color: Theme.colors.textMuted, marginTop: 4, fontSize: 12 },

  // Job Card
  jobCard: { position: 'relative', borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Theme.spacing.xs },
  jobIdBlock: {},
  jobIdLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  jobIdText: { color: Theme.colors.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Theme.borderRadius.pill, borderWidth: 1.5, gap: 5 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

  // Rider MiniMap Styles
  mapWrapper: { marginBottom: Theme.spacing.md, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1.5, borderColor: Theme.colors.border, borderRadius: Theme.borderRadius.md, overflow: 'hidden' },
  mapHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Theme.spacing.sm, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
  mapLabel: { color: Theme.colors.textMuted, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8 },
  mapSubLabel: { color: Theme.colors.primary, fontSize: 8.5, fontWeight: '700', letterSpacing: 0.2 },
  mapCanvas: { width: '100%', overflow: 'hidden' },

  // Route Card
  routeCard: { position: 'relative', borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: 'rgba(112,0,255,0.3)', padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  routeRow: { flexDirection: 'row', justifyContent: 'space-around', zIndex: 1 },
  routeStat: { alignItems: 'center', flex: 1, gap: 4 },
  routeStatLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  routeStatValue: { color: Theme.colors.text, fontSize: 16, fontWeight: '900' },
  routeDivider: { width: 1, backgroundColor: Theme.colors.border },

  // Rider
  riderRow: { flexDirection: 'column', gap: 4, marginBottom: Theme.spacing.md, backgroundColor: 'rgba(0,0,0,0.2)', padding: Theme.spacing.sm, borderRadius: Theme.borderRadius.md },
  riderInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riderText: { color: Theme.colors.text, fontSize: 13, fontWeight: '700' },
  riderVehicle: { color: Theme.colors.textMuted, fontSize: 12 },

  // Order meta
  orderMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.md },
  orderMetaItem: { flex: 1 },
  orderMetaLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  orderMetaValue: { color: Theme.colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },

  // Advance button
  advanceBtn: { height: 44, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  advanceBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 0.5, marginRight: 4 },

  // Interactive Maps Toggles
  mapToggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Theme.borderRadius.sm, padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  mapToggleBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  mapToggleBtnActive: { backgroundColor: Theme.colors.primary },
  mapToggleText: { color: Theme.colors.textMuted, fontSize: 8.5, fontWeight: '700' },
  mapToggleTextActive: { color: '#000' },

  // Native Client fallbacks
  nativeMapBtn: { margin: Theme.spacing.sm, height: 38, backgroundColor: 'rgba(0, 240, 255, 0.1)', borderWidth: 1.5, borderColor: Theme.colors.primary, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  nativeMapBtnText: { color: Theme.colors.primary, fontWeight: '900', fontSize: 11, letterSpacing: 0.3 },
});
