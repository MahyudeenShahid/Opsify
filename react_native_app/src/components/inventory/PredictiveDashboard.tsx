import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';
import { MessageSquare, Zap, Truck, CheckCircle2, ShieldAlert, Award, FileSpreadsheet, FileText } from 'lucide-react-native';

interface Props {
  predictions: any[];
  suggestions: any[];
  products?: any[];
  warehouses?: any[];
  onProcurementApproved?: () => void;
}

export const PredictiveDashboard: React.FC<Props> = ({ onProcurementApproved }) => {
  const [lat, setLat] = useState(24.8138);
  const [lng, setLng] = useState(67.0366);
  
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedVendorIndex, setSelectedVendorIndex] = useState(0);
  const [successLogs, setSuccessLogs] = useState<string[]>([]);
  const [successId, setSuccessId] = useState("");

  const loadAgriData = async () => {
    setLoading(true);
    try {
      // Get live geolocated coordinates if available
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const currentLat = pos.coords.latitude;
            const currentLng = pos.coords.longitude;
            setLat(currentLat);
            setLng(currentLng);
            fetchFeed(currentLat, currentLng);
          },
          () => {
            fetchFeed(lat, lng);
          }
        );
      } else {
        fetchFeed(lat, lng);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchFeed = async (tLat: number, tLng: number) => {
    try {
      const res = await ApiService.getAgriDemandFeed(tLat, tLng);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgriData();
  }, []);

  const handleLaunchSharedDispatch = async () => {
    setDispatching(true);
    setSuccessLogs([]);
    setSuccessId("");
    try {
      const res = await ApiService.dispatchAgriShared(lat, lng);
      if (res.status === 'success') {
        setSuccessId(res.dispatch_id);
        setSuccessLogs(res.dispatch_logs || []);
        if (onProcurementApproved) onProcurementApproved(); // Refresh products list
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDispatching(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.syncText}>Aggregating street vendor WhatsApp orders near Clifton...</Text>
      </View>
    );
  }

  const feed = data?.feed || [];
  const agg = data?.aggregation || {};
  const analysis = data?.logistics_analysis || {};
  const invoices = data?.invoices || [];
  const activeInvoice = invoices[selectedVendorIndex] || null;

  return (
    <View style={styles.container}>
      
      {/* 1. AGRI-BRIDGE STATUS HERO */}
      <View style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroLeft}>
            <View style={styles.greenBadge}>
              <Text style={styles.greenBadgeText}>🟢 LIVE SYNCHRONIZER ACTIVE</Text>
            </View>
            <Text style={styles.heroTitle}>Agri-Bridge Core</Text>
            <Text style={styles.heroSub}>Aggregating demand streams for fresh crops in Karachi South.</Text>
          </View>
          <View style={styles.efficiencyCircle}>
            <Text style={styles.effVal}>{analysis.fuel_saved_percent || 72}%</Text>
            <Text style={styles.effLabel}>Fuel Saved</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{feed.length} Vendors</Text>
            <Text style={styles.metricLabel}>WhatsApp Sourced</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>{analysis.individual_total_dist_km} km</Text>
            <Text style={styles.metricLabel}>Standard Last-Mile</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={[styles.metricVal, { color: Theme.colors.primary }]}>{analysis.shared_total_dist_km} km</Text>
            <Text style={styles.metricLabel}>Optimized Loop</Text>
          </View>
        </View>
      </View>

      {/* 2. AGGREGATED PRODUCE DEMAND PANEL */}
      <Text style={styles.sectionTitle}>🥦 Aggregated Crop Demands</Text>
      <View style={styles.aggregationContainer}>
        {Object.keys(agg).map((crop) => {
          const qty = agg[crop];
          const maxVal = 300; // Normalizing scale for indicator progress
          const progress = Math.min(1.0, qty / maxVal);
          const icon = crop.includes('Tomato') ? '🍅' : crop.includes('Mango') ? '🥭' : crop.includes('Onion') ? '🧅' : crop.includes('Potato') ? '🥔' : '🥬';
          
          return (
            <View key={crop} style={styles.cropCard}>
              <View style={styles.cropHeader}>
                <Text style={styles.cropName}>{icon} {crop}</Text>
                <Text style={styles.cropQty}>{qty} {crop.includes('Spinach') ? 'Bunches' : 'kg'}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* 3. DISPATCH CONTROLLER & LOGS */}
      <Text style={styles.sectionTitle}>⚡ Shared Logistics Dispatcher</Text>
      <View style={styles.dispatchCard}>
        {successId ? (
          <View style={styles.successArea}>
            <CheckCircle2 color={Theme.colors.primary} size={48} style={{ marginBottom: 12 }} />
            <Text style={styles.successTitle}>SHARED ROUTE DISPATCHED SUCCESSFULLY!</Text>
            <Text style={styles.successSub}>ID: {successId}</Text>
            <View style={styles.logsBox}>
              {successLogs.map((log, idx) => (
                <Text key={idx} style={styles.logLine}>✓ {log}</Text>
              ))}
            </View>
            <TouchableOpacity style={styles.resetBtn} onPress={() => { setSuccessId(""); setSuccessLogs([]); }}>
              <Text style={styles.resetBtnText}>Prepare Next Delivery Loop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dispatchActionRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.dispatchInfoText}>
                Press dispatch to orchestrate a single shared delivery run for all 50 vendors. This auto-updates your ERP ledger and deducts warehouse stock instantly.
              </Text>
            </View>
            <TouchableOpacity style={styles.dispatchBtn} onPress={handleLaunchSharedDispatch} disabled={dispatching}>
              {dispatching ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Truck size={18} color="#070A0E" style={{ marginRight: 6 }} />
                  <Text style={styles.dispatchBtnText}>Launch Route</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 4. WHATSAPP FEED TICKER & E-INVOICING HUB */}
      <View style={styles.gridRow}>
        
        {/* WhatsApp Feed Ticker */}
        <View style={styles.gridCol}>
          <Text style={styles.sectionTitle}>💬 WhatsApp Demand Ticker</Text>
          <ScrollView style={styles.whatsappTicker}>
            {feed.map((entry: any, index: number) => (
              <TouchableOpacity 
                key={entry.vendor_id} 
                style={[styles.msgBubble, selectedVendorIndex === index && styles.msgBubbleActive]}
                onPress={() => setSelectedVendorIndex(index)}
              >
                <View style={styles.msgHeader}>
                  <MessageSquare size={12} color={Theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.msgVendorName}>{entry.vendor_name}</Text>
                  <Text style={styles.msgTime}>{entry.timestamp}</Text>
                </View>
                <Text style={styles.msgText} numberOfLines={2}>{entry.message}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* E-Invoice Simulator */}
        <View style={styles.gridCol}>
          <Text style={styles.sectionTitle}>🧾 E-Invoice Hub (+20% Profit)</Text>
          {activeInvoice ? (
            <View style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <FileText size={18} color={Theme.colors.secondary} />
                <Text style={styles.invoiceTitle}>DIGITAL INVOICE</Text>
              </View>
              
              <Text style={styles.invoiceVendorName}>{activeInvoice.vendor_name}</Text>
              
              <View style={styles.invoiceLine}>
                <Text style={styles.invoiceLabel}>{activeInvoice.crop} ({activeInvoice.quantity}{activeInvoice.unit})</Text>
                <Text style={styles.invoiceVal}>Rs {activeInvoice.cargo_cost}</Text>
              </View>
              
              <View style={styles.invoiceLine}>
                <Text style={styles.invoiceLabel}>Shared Drop Fee</Text>
                <Text style={styles.invoiceVal}>Rs {activeInvoice.logistics_cost}</Text>
              </View>

              <View style={[styles.invoiceLine, styles.invoiceTotalLine]}>
                <Text style={styles.invoiceTotalLabel}>Total Payee Value</Text>
                <Text style={styles.invoiceTotalVal}>Rs {activeInvoice.total_invoice}</Text>
              </View>

              {/* Profit Gain Banner */}
              <View style={styles.profitBanner}>
                <Award color={Theme.colors.secondary} size={16} style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.profitBannerText}>
                    Logistics Optimization Gain: <Text style={{ fontWeight: 'bold', color: Theme.colors.secondary }}>{activeInvoice.projected_profit_gain}</Text>
                  </Text>
                  <Text style={styles.profitBannerSub}>Saved Rs {activeInvoice.net_savings} in last-mile overhead!</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.invoiceCard, { justifyContent: 'center', alignItems: 'center', height: 230 }]}>
              <Text style={{ color: Theme.colors.textMuted }}>Select a WhatsApp vendor cart message to compile invoice.</Text>
            </View>
          )}
        </View>

      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: Theme.spacing.lg,
  },
  centerContainer: {
    padding: Theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    height: 300,
  },
  syncText: {
    color: Theme.colors.textMuted,
    marginTop: Theme.spacing.md,
    fontSize: 13,
    textAlign: 'center',
  },
  sectionTitle: {
    color: Theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginVertical: Theme.spacing.md,
    textTransform: 'uppercase',
  },
  heroCard: {
    backgroundColor: Theme.colors.surface,
    borderColor: 'rgba(0, 230, 118, 0.25)',
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  heroLeft: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  greenBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  greenBadgeText: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 9,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSub: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  efficiencyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  effVal: {
    color: Theme.colors.primary,
    fontWeight: '900',
    fontSize: 18,
  },
  effLabel: {
    color: Theme.colors.textMuted,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: Theme.spacing.md,
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  metricLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  aggregationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cropCard: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    flex: 1,
    minWidth: 150,
  },
  cropHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cropName: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cropQty: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Theme.colors.primary,
    borderRadius: 2,
  },
  dispatchCard: {
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
  },
  dispatchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dispatchInfoText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  dispatchBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dispatchBtnText: {
    color: '#070A0E',
    fontWeight: 'bold',
    fontSize: 13,
  },
  successArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successTitle: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  successSub: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  logsBox: {
    backgroundColor: Theme.colors.terminalBg,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    padding: Theme.spacing.sm,
    width: '100%',
    marginBottom: 12,
  },
  logLine: {
    color: Theme.colors.primary,
    fontSize: 10.5,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resetBtnText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: Theme.spacing.xs,
  },
  gridCol: {
    flex: 1,
  },
  whatsappTicker: {
    maxHeight: 230,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.xs,
  },
  msgBubble: {
    padding: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  msgBubbleActive: {
    backgroundColor: 'rgba(0, 230, 118, 0.07)',
    borderColor: 'rgba(0, 230, 118, 0.3)',
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  msgVendorName: {
    color: '#FFF',
    fontSize: 10.5,
    fontWeight: 'bold',
    flex: 1,
  },
  msgTime: {
    color: Theme.colors.textMuted,
    fontSize: 9,
  },
  msgText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  invoiceCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.md,
    height: 230,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingBottom: 8,
    marginBottom: 10,
  },
  invoiceTitle: {
    color: Theme.colors.secondary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.0,
  },
  invoiceVendorName: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 12,
  },
  invoiceLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceLabel: {
    color: Theme.colors.textMuted,
    fontSize: 12,
  },
  invoiceVal: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  invoiceTotalLine: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 6,
    marginTop: 8,
  },
  invoiceTotalLabel: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  invoiceTotalVal: {
    color: Theme.colors.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  profitBanner: {
    marginTop: 'auto',
    backgroundColor: 'rgba(255, 196, 0, 0.1)',
    borderRadius: Theme.borderRadius.sm,
    borderColor: 'rgba(255, 196, 0, 0.25)',
    borderWidth: 1,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profitBannerText: {
    color: '#FFF',
    fontSize: 10,
  },
  profitBannerSub: {
    color: Theme.colors.secondary,
    fontSize: 9.5,
    fontWeight: 'bold',
  },
});
