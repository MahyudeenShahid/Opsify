import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Modal, TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  MapPin, Star, Clock, DollarSign, Phone, CheckCircle,
  XCircle, ChevronDown, ChevronUp, Zap, RefreshCw,
} from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Vendor {
  id: string;
  name: string;
  address: string;
  rating: number;
  distance: string;
  price: string;
  contact: string;
  reliability_score: number;
  lead_time_days: number;
}

interface PendingAlert {
  product_id: number;
  product_name: string;
  warehouse_id: number;
  warehouse_location: string;
  suggestions: Vendor[];
}

interface Props {
  suggestions: any[];  // from /api/inventory/suggestions
  products: any[];
  warehouses: any[];
  onProcurementApproved: () => void;
}

export const ProcurementApproval: React.FC<Props> = ({
  suggestions, products, warehouses, onProcurementApproved
}) => {
  const [pendingAlerts, setPendingAlerts] = useState<PendingAlert[]>([]);
  const [loadingVendors, setLoadingVendors] = useState<Record<string, boolean>>({});
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    vendor: Vendor; alert: PendingAlert; qty: string;
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Build pending alerts from low-stock suggestions
  const loadVendorsForAlert = async (sug: any) => {
    const key = `${sug.product_id}`;
    if (pendingAlerts.find(p => p.product_id === sug.product_id)) return;
    setLoadingVendors(prev => ({ ...prev, [key]: true }));
    try {
      const wh = warehouses.find(w => w.id === sug.warehouse_id) || warehouses[0] || {};
      // Use Pakistan coords as default
      const lat = wh.location?.toLowerCase().includes('lahore') ? 31.5204 : 24.8607;
      const lng = wh.location?.toLowerCase().includes('lahore') ? 74.3587 : 67.0011;

      const vendorSuggestions = await ApiService.getSupplierSuggestions(sug.product_name, lat, lng);
      const wh_name = wh.name || wh.location || 'Default Warehouse';
      setPendingAlerts(prev => [...prev, {
        product_id: sug.product_id,
        product_name: sug.product_name,
        warehouse_id: sug.warehouse_id || 1,
        warehouse_location: wh_name,
        suggestions: vendorSuggestions,
      }]);
    } catch (e) {
      console.error('Vendor fetch error:', e);
    } finally {
      setLoadingVendors(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleApprove = async () => {
    if (!confirmModal) return;
    const { vendor, alert, qty } = confirmModal;
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity to restock.');
      return;
    }
    setIsApproving(true);
    try {
      await ApiService.approveProcurement({
        product_id: alert.product_id,
        warehouse_id: alert.warehouse_id,
        quantity,
        vendor,
      });
      setConfirmModal(null);
      setPendingAlerts(prev => prev.filter(p => p.product_id !== alert.product_id));
      Alert.alert(
        '✅ Procurement Approved!',
        `${quantity} units of ${alert.product_name} restocked from ${vendor.name}. Supplier added to your list.`
      );
      onProcurementApproved();
    } catch (e: any) {
      Alert.alert('Approval Failed', e.message);
    } finally {
      setIsApproving(false);
    }
  };

  const urgentSuggestions = suggestions.filter(s => s.urgency === 'High' || s.urgency === 'Medium');

  if (urgentSuggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <Animated.View style={[styles.headerBanner, { transform: [{ scale: pulseAnim }] }]}>
        <Zap color={Theme.colors.warning} size={16} />
        <Text style={styles.headerBannerText}>
          {urgentSuggestions.length} Restock Alert{urgentSuggestions.length > 1 ? 's' : ''} — User Approval Required
        </Text>
      </Animated.View>

      {urgentSuggestions.map((sug, idx) => {
        const key = `${sug.product_id}`;
        const isExpanded = expandedAlert === key;
        const alert = pendingAlerts.find(p => p.product_id === sug.product_id);
        const isLoading = loadingVendors[key];

        return (
          <View key={key} style={styles.alertCard}>
            {/* Alert Header Row */}
            <TouchableOpacity
              style={styles.alertHeaderRow}
              onPress={() => {
                if (!isExpanded) {
                  setExpandedAlert(key);
                  loadVendorsForAlert(sug);
                } else {
                  setExpandedAlert(null);
                }
              }}
            >
              <View style={styles.alertLeft}>
                <View style={[styles.urgencyDot, { backgroundColor: sug.urgency === 'High' ? Theme.colors.error : Theme.colors.warning }]} />
                <View>
                  <Text style={styles.alertProductName}>{sug.product_name}</Text>
                  <Text style={styles.alertMessage}>{sug.message}</Text>
                </View>
              </View>
              {isExpanded ? <ChevronUp color={Theme.colors.textMuted} size={18} /> : <ChevronDown color={Theme.colors.textMuted} size={18} />}
            </TouchableOpacity>

            {/* Expanded: Vendor Carousel */}
            {isExpanded && (
              <View style={styles.vendorSection}>
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={Theme.colors.primary} />
                    <Text style={styles.loadingText}>Scanning nearby suppliers via Google Maps...</Text>
                  </View>
                ) : alert ? (
                  <>
                    <Text style={styles.vendorSectionTitle}>📍 Top Suppliers Near {alert.warehouse_location}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vendorScroll}>
                      {alert.suggestions.map((vendor, vi) => (
                        <TouchableOpacity
                          key={vendor.id}
                          style={[styles.vendorCard, vi === 0 && styles.vendorCardBest]}
                          onPress={() => setConfirmModal({ vendor, alert, qty: '50' })}
                        >
                          {vi === 0 && (
                            <View style={styles.bestBadge}>
                              <Text style={styles.bestBadgeText}>⚡ BEST</Text>
                            </View>
                          )}
                          <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
                          <View style={styles.vendorDetailRow}>
                            <MapPin size={11} color={Theme.colors.textMuted} />
                            <Text style={styles.vendorDetailText} numberOfLines={1}>{vendor.distance}</Text>
                          </View>
                          <View style={styles.vendorDetailRow}>
                            <Star size={11} color={Theme.colors.warning} />
                            <Text style={styles.vendorDetailText}>{vendor.rating} / 5.0</Text>
                          </View>
                          <View style={styles.vendorDetailRow}>
                            <DollarSign size={11} color={Theme.colors.success} />
                            <Text style={styles.vendorDetailText}>{vendor.price}/unit</Text>
                          </View>
                          <View style={styles.vendorDetailRow}>
                            <Clock size={11} color={Theme.colors.primary} />
                            <Text style={styles.vendorDetailText}>{vendor.lead_time_days}d lead</Text>
                          </View>
                          <View style={styles.vendorDetailRow}>
                            <Phone size={11} color={Theme.colors.textMuted} />
                            <Text style={styles.vendorDetailText} numberOfLines={1}>{vendor.contact}</Text>
                          </View>
                          <View style={styles.reliabilityBar}>
                            <View style={[styles.reliabilityFill, { width: `${Math.min(vendor.reliability_score, 100)}%` as any }]} />
                          </View>
                          <Text style={styles.reliabilityLabel}>{vendor.reliability_score.toFixed(0)}% Reliability</Text>
                          <TouchableOpacity
                            style={styles.approveBtn}
                            onPress={() => setConfirmModal({ vendor, alert, qty: '50' })}
                          >
                            <CheckCircle size={12} color={Theme.colors.background} />
                            <Text style={styles.approveBtnText}>Select</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                ) : null}
              </View>
            )}
          </View>
        );
      })}

      {/* Confirmation Modal */}
      <Modal visible={!!confirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={styles.modalBlur}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Confirm Procurement</Text>
              {confirmModal && (
                <>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>Product</Text>
                    <Text style={styles.modalValue}>{confirmModal.alert.product_name}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>Supplier</Text>
                    <Text style={styles.modalValue}>{confirmModal.vendor.name}</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>Price</Text>
                    <Text style={[styles.modalValue, { color: Theme.colors.success }]}>{confirmModal.vendor.price}/unit</Text>
                  </View>
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalLabel}>Lead Time</Text>
                    <Text style={styles.modalValue}>{confirmModal.vendor.lead_time_days} days</Text>
                  </View>
                  <Text style={styles.modalQtyLabel}>Quantity to Restock:</Text>
                  <TextInput
                    style={styles.modalQtyInput}
                    keyboardType="numeric"
                    value={confirmModal.qty}
                    onChangeText={q => setConfirmModal({ ...confirmModal, qty: q })}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModal(null)}>
                      <XCircle size={16} color={Theme.colors.error} />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleApprove} disabled={isApproving}>
                      {isApproving
                        ? <ActivityIndicator size="small" color={Theme.colors.background} />
                        : <><CheckCircle size={16} color={Theme.colors.background} /><Text style={styles.confirmBtnText}>Approve</Text></>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: Theme.spacing.lg },
  headerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,184,0,0.12)', borderWidth: 1,
    borderColor: Theme.colors.warning, borderRadius: Theme.borderRadius.lg,
    paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  headerBannerText: { color: Theme.colors.warning, fontWeight: '700', fontSize: 13 },
  alertCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: Theme.colors.border, borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.sm, overflow: 'hidden',
  },
  alertHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Theme.spacing.md,
  },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  urgencyDot: { width: 10, height: 10, borderRadius: 5 },
  alertProductName: { color: Theme.colors.text, fontWeight: '700', fontSize: 14 },
  alertMessage: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  vendorSection: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.md },
  vendorSectionTitle: { color: Theme.colors.primary, fontSize: 12, fontWeight: '700', marginBottom: Theme.spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Theme.spacing.md },
  loadingText: { color: Theme.colors.textMuted, fontSize: 12 },
  vendorScroll: { flexDirection: 'row' },
  vendorCard: {
    width: 155, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg,
    borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.sm,
    marginRight: Theme.spacing.sm,
  },
  vendorCardBest: { borderColor: Theme.colors.primary, backgroundColor: 'rgba(0,240,255,0.05)' },
  bestBadge: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 6,
  },
  bestBadgeText: { color: Theme.colors.background, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  vendorName: { color: Theme.colors.text, fontWeight: '700', fontSize: 12, marginBottom: 6 },
  vendorDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  vendorDetailText: { color: Theme.colors.textMuted, fontSize: 11 },
  reliabilityBar: {
    height: 3, backgroundColor: Theme.colors.border, borderRadius: 99,
    marginTop: 8, overflow: 'hidden',
  },
  reliabilityFill: { height: '100%', backgroundColor: Theme.colors.success, borderRadius: 99 },
  reliabilityLabel: { color: Theme.colors.textMuted, fontSize: 9.5, marginTop: 3, marginBottom: 8 },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, backgroundColor: Theme.colors.primary, borderRadius: Theme.borderRadius.md,
    paddingVertical: 6,
  },
  approveBtnText: { color: Theme.colors.background, fontWeight: '800', fontSize: 12 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBlur: { borderRadius: Theme.borderRadius.xl, overflow: 'hidden', width: 320 },
  modalContent: {
    backgroundColor: 'rgba(20,24,40,0.9)', padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.xl, borderWidth: 1, borderColor: Theme.colors.primary,
  },
  modalTitle: { color: Theme.colors.primary, fontWeight: '800', fontSize: 18, marginBottom: Theme.spacing.md, textAlign: 'center' },
  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
  modalLabel: { color: Theme.colors.textMuted, fontSize: 12 },
  modalValue: { color: Theme.colors.text, fontWeight: '600', fontSize: 12 },
  modalQtyLabel: { color: Theme.colors.textMuted, fontSize: 12, marginTop: Theme.spacing.md, marginBottom: 6 },
  modalQtyInput: {
    backgroundColor: Theme.colors.surface, borderWidth: 1, borderColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md, color: Theme.colors.text, fontSize: 20,
    fontWeight: '700', paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm,
    textAlign: 'center', marginBottom: Theme.spacing.md,
  },
  modalButtons: { flexDirection: 'row', gap: Theme.spacing.sm },
  cancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Theme.spacing.sm, borderRadius: Theme.borderRadius.md,
    borderWidth: 1, borderColor: Theme.colors.error,
  },
  cancelBtnText: { color: Theme.colors.error, fontWeight: '700', fontSize: 14 },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Theme.spacing.sm, borderRadius: Theme.borderRadius.md,
    backgroundColor: Theme.colors.primary,
  },
  confirmBtnText: { color: Theme.colors.background, fontWeight: '800', fontSize: 14 },
});
