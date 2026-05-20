import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View,
  ActivityIndicator, ScrollView, Alert, Animated, Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Activity, ScanLine, Play, CheckCircle, XCircle, Clock,
  MessageSquare, Package, Zap, ChevronDown, ChevronUp,
  Send, Mic, MicOff, RefreshCw, History, AlertCircle, Trash2, Edit2
} from 'lucide-react-native';

import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { TraceTerminal } from '../widgets/TraceTerminal';
import { FirebaseChatService } from '../services/firebaseChatService';
import { auth } from '../config/firebaseConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DetectedOrder {
  chat_id: string;
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT';
  contact_name: string;
  item: string;
  quantity: number;
  value: number;
  warehouse_id: number;
  reason: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  source_message?: string;
}

interface ScanMeta {
  total_chats: number;
  total_messages_scanned: number;
  new_messages_scanned: number;
  scanned_at: string;
  per_chat: Array<{
    chat_id: string;
    contact_name: string;
    messages_scanned: number;
    total_messages: number;
    is_incremental: boolean;
    status: string;
  }>;
}

interface ScanSession {
  session_id?: string;
  scanned_at: string;
  total_chats: number;
  new_messages_scanned: number;
  orders_detected: number;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG = {
  HIGH:   { color: '#00FFA3', bg: 'rgba(0,255,163,0.1)'  },
  MEDIUM: { color: '#FFB800', bg: 'rgba(255,184,0,0.1)'  },
  LOW:    { color: '#FF9100', bg: 'rgba(255,145,0,0.1)'  },
};

// ─── Order Card with Approve / Reject ─────────────────────────────────────────

const OrderCard = ({
  order,
  index,
  onApprove,
  onReject,
  onSave,
}: {
  order: DetectedOrder;
  index: number;
  onApprove: () => void;
  onReject: () => void;
  onSave: (updated: DetectedOrder) => void;
}) => {
  const slideY = useRef(new Animated.Value(40)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const [showSource, setShowSource] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editItem, setEditItem] = useState(order.item);
  const [editQuantity, setEditQuantity] = useState(String(order.quantity));
  const [editValue, setEditValue] = useState(String(order.value));
  const [editWarehouse, setEditWarehouse] = useState(String(order.warehouse_id));
  const [editType, setEditType] = useState(order.type);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, friction: 7, delay: index * 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSaveClick = () => {
    const qty = parseFloat(editQuantity);
    const val = parseFloat(editValue);
    const wh = parseInt(editWarehouse, 10);

    if (!editItem.trim()) {
      Alert.alert('Validation Error', 'Item name cannot be empty.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Quantity must be a positive number.');
      return;
    }
    if (isNaN(val) || val < 0) {
      Alert.alert('Validation Error', 'Value must be a valid number.');
      return;
    }
    if (isNaN(wh) || wh <= 0) {
      Alert.alert('Validation Error', 'Warehouse ID must be a positive integer.');
      return;
    }

    onSave({
      ...order,
      item: editItem.trim(),
      quantity: qty,
      value: val,
      warehouse_id: wh,
      type: editType,
    });
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setEditItem(order.item);
    setEditQuantity(String(order.quantity));
    setEditValue(String(order.value));
    setEditWarehouse(String(order.warehouse_id));
    setEditType(order.type);
    setIsEditing(false);
  };

  const isSale    = editType === 'SALE';
  const isRestock = editType === 'RESTOCK';
  const typeColor = isSale ? Theme.colors.primary : isRestock ? '#00B0FF' : Theme.colors.warning;
  const typeBg    = isSale ? 'rgba(0,230,118,0.08)' : isRestock ? 'rgba(0,176,255,0.08)' : 'rgba(255,184,0,0.08)';
  const conf      = order.confidence || 'MEDIUM';
  const confCfg   = CONFIDENCE_CONFIG[conf];

  return (
    <Animated.View style={[styles.orderCard, { opacity: fadeIn, transform: [{ translateY: slideY }], borderColor: `${typeColor}40` }]}>
      <LinearGradient colors={[typeBg, 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            {isEditing ? (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[styles.typeSelectBtn, editType === 'SALE' && { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary }]}
                  onPress={() => setEditType('SALE')}
                >
                  <Text style={[styles.typeSelectBtnText, editType === 'SALE' && { color: '#000' }]}>SALE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeSelectBtn, editType === 'RESTOCK' && { backgroundColor: '#00B0FF', borderColor: '#00B0FF' }]}
                  onPress={() => setEditType('RESTOCK')}
                >
                  <Text style={[styles.typeSelectBtnText, editType === 'RESTOCK' && { color: '#000' }]}>RESTOCK</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeSelectBtn, editType === 'ADJUSTMENT' && { backgroundColor: Theme.colors.warning, borderColor: Theme.colors.warning }]}
                  onPress={() => setEditType('ADJUSTMENT')}
                >
                  <Text style={[styles.typeSelectBtnText, editType === 'ADJUSTMENT' && { color: '#000' }]}>ADJUST</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.typePill, { backgroundColor: `${typeColor}15`, borderColor: typeColor }]}>
                  <Text style={[styles.typePillText, { color: typeColor }]}>{editType}</Text>
                </View>
                <View style={[styles.confPill, { backgroundColor: confCfg.bg, borderColor: confCfg.color }]}>
                  <Text style={[styles.confPillText, { color: confCfg.color }]}>{conf}</Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.contactName}>{order.contact_name}</Text>
          <Text style={styles.chatIdText}>chat: {order.chat_id.slice(0, 20)}…</Text>
        </View>
      </View>

      {/* Stats / Edit Fields */}
      {isEditing ? (
        <View style={styles.editFieldsContainer}>
          <View style={styles.editFieldRow}>
            <Text style={styles.editFieldLabel}>PRODUCT ITEM</Text>
            <TextInput
              style={styles.cardInput}
              value={editItem}
              onChangeText={setEditItem}
              placeholder="e.g. Milk, Wire"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          </View>

          <View style={styles.editFieldRowGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.editFieldLabel}>QTY</Text>
              <TextInput
                style={styles.cardInput}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text style={styles.editFieldLabel}>VALUE (Rs)</Text>
              <TextInput
                style={styles.cardInput}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.editFieldLabel}>WH ID</Text>
              <TextInput
                style={styles.cardInput}
                value={editWarehouse}
                onChangeText={setEditWarehouse}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>ITEM</Text>
            <Text style={[styles.statValue, { color: typeColor }]}>{editItem}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>QTY</Text>
            <Text style={styles.statValue}>{editQuantity}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>VALUE</Text>
            <Text style={[styles.statValue, { color: Theme.colors.secondary }]}>Rs {parseFloat(editValue).toFixed(0)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>WH</Text>
            <Text style={styles.statValue}>#{editWarehouse}</Text>
          </View>
        </View>
      )}

      {/* AI Reason */}
      {!isEditing && (
        <View style={styles.reasonBox}>
          <Zap size={12} color={Theme.colors.primary} />
          <Text style={styles.reasonText}>{order.reason}</Text>
        </View>
      )}

      {/* Source Message Toggle */}
      {!isEditing && order.source_message ? (
        <TouchableOpacity style={styles.sourceToggle} onPress={() => setShowSource(!showSource)}>
          <MessageSquare size={12} color={Theme.colors.textMuted} />
          <Text style={styles.sourceToggleText}>Source message</Text>
          {showSource ? <ChevronUp size={12} color={Theme.colors.textMuted} /> : <ChevronDown size={12} color={Theme.colors.textMuted} />}
        </TouchableOpacity>
      ) : null}
      {!isEditing && showSource && order.source_message ? (
        <View style={styles.sourceBox}>
          <Text style={styles.sourceText}>"{order.source_message}"</Text>
        </View>
      ) : null}

      {/* Action Buttons */}
      {isEditing ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.approveBtn} onPress={handleSaveClick}>
            <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            <CheckCircle size={16} color="#000" />
            <Text style={styles.approveBtnText}>Save Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={handleCancelClick}>
            <XCircle size={16} color={Theme.colors.error} />
            <Text style={styles.rejectBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
            <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            <CheckCircle size={16} color="#000" />
            <Text style={styles.approveBtnText}>Approve & Book</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
            <Edit2 size={14} color={Theme.colors.text} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
            <XCircle size={16} color={Theme.colors.error} />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

// ─── Scan Progress Item ───────────────────────────────────────────────────────

const ScanProgressItem = ({ chat, isActive }: { chat: any; isActive: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [isActive]);

  return (
    <View style={styles.progressItem}>
      <Animated.View style={[styles.progressDot, {
        backgroundColor: chat.status === 'UP_TO_DATE' ? Theme.colors.textMuted : Theme.colors.primary,
        transform: [{ scale: isActive ? pulse : new Animated.Value(1) }]
      }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.progressChatName}>{chat.contact_name}</Text>
        <Text style={styles.progressMeta}>
          {chat.status === 'UP_TO_DATE'
            ? 'Already up to date'
            : `${chat.messages_scanned} new messages scanned`}
          {chat.is_incremental ? ' (incremental)' : ' (full)'}
        </Text>
      </View>
      {chat.status === 'UP_TO_DATE'
        ? <Text style={styles.progressCheck}>✓</Text>
        : isActive
          ? <ActivityIndicator size="small" color={Theme.colors.primary} />
          : <Text style={[styles.progressCheck, { color: Theme.colors.primary }]}>✓</Text>
      }
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const CustomerBrainScreen: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<any[]>([]);
  const [activeScanIdx, setActiveScanIdx] = useState(-1);
  const [detectedOrders, setDetectedOrders] = useState<DetectedOrder[]>([]);
  const [persistedOrders, setPersistedOrders] = useState<DetectedOrder[]>([]); // from Firestore
  const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrackedChats, setShowTrackedChats] = useState(false);
  const [scanState, setScanState] = useState<any>(null);
  const [isLoadingPersisted, setIsLoadingPersisted] = useState(false);

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await ApiService.deleteScanSession(sessionId);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      loadScanState();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleClearHistory = async () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all scan session history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.clearAllScanSessions();
              setSessions([]);
              loadScanState();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const handleDeleteCursor = async (chatId: string) => {
    try {
      await ApiService.deleteScanCursor(chatId);
      loadScanState();
      Alert.alert('Cursor Reset', 'Cursor deleted. This chat will be fully scanned next time.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleResetAllCursors = async () => {
    Alert.alert(
      'Reset All Cursors',
      'This will reset the scan status for all chats, causing the next run to perform a full scan on all of them. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.clearAllScanCursors();
              loadScanState();
              Alert.alert('Success', 'All cursors reset successfully.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  // Manual override
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<any>(null);
  const micPulse = useRef(new Animated.Value(1)).current;

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const agentDotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(agentDotPulse, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(agentDotPulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    loadScanState();
    loadPersistedOrders();
  }, []);

  const loadScanState = async () => {
    try {
      const state = await ApiService.getScanState();
      setScanState(state);
      setSessions(state.sessions || []);
    } catch (e) {
      // Backend may not be running yet
    }
  };

  const loadPersistedOrders = async () => {
    setIsLoadingPersisted(true);
    try {
      const pending = await ApiService.getPendingOrders();
      setPersistedOrders(pending);
    } catch (e) {
      // Silently ignore if backend not available
    } finally {
      setIsLoadingPersisted(false);
    }
  };

  const handleSave = async (originalOrder: DetectedOrder, updatedOrder: DetectedOrder) => {
    try {
      const fp = (originalOrder as any).fingerprint;
      if (fp) {
        // Persisted order: update on backend/Firestore
        await ApiService.updatePendingOrder(fp, {
          item: updatedOrder.item,
          quantity: updatedOrder.quantity,
          value: updatedOrder.value,
          warehouse_id: updatedOrder.warehouse_id,
          type: updatedOrder.type,
        });
        setPersistedOrders(prev => prev.map(o => {
          if (o.chat_id === originalOrder.chat_id && o.item === originalOrder.item && o.quantity === originalOrder.quantity) {
            return { ...o, ...updatedOrder };
          }
          return o;
        }));
      } else {
        // Newly detected order in active scan: update locally
        setDetectedOrders(prev => prev.map(o => {
          if (o.chat_id === originalOrder.chat_id && o.item === originalOrder.item && o.quantity === originalOrder.quantity) {
            return { ...o, ...updatedOrder };
          }
          return o;
        }));
      }
      Alert.alert('✅ Order Updated', 'Changes saved successfully.');
    } catch (e: any) {
      Alert.alert('Update Error', e.message);
    }
  };

  // ── Deep Scan ────────────────────────────────────────────────────────────
  const handleRunAgent = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign In Required', 'You need to be signed in to scan chats.');
      return;
    }

    setIsScanning(true);
    setDetectedOrders([]);
    setScanProgress([]);
    setScanMeta(null);
    setActiveScanIdx(-1);

    try {
      // 1. Fetch all chats with FULL message history
      setTraceLogs(prev => [...prev, '[System1] 🔍 Fetching all chats with full message history...']);
      const chatsWithMessages = await FirebaseChatService.getAllChatsWithMessages(user.uid);

      if (chatsWithMessages.length === 0) {
        setTraceLogs(prev => [...prev, '[System1] ℹ️ No chats found. Start a conversation first.']);
        setIsScanning(false);
        return;
      }

      setTraceLogs(prev => [...prev, `[System1] 📋 Found ${chatsWithMessages.length} chat(s). Running Gemini analysis...`]);

      // Show progress placeholders
      setScanProgress(chatsWithMessages.map(c => ({
        chat_id: c.id,
        contact_name: c.users?.[0]?.name || c.id,
        status: 'PENDING',
        messages_scanned: c.messages.length,
        is_incremental: false,
      })));

      // Simulate per-chat progress animation
      for (let i = 0; i < chatsWithMessages.length; i++) {
        setActiveScanIdx(i);
        await new Promise(r => setTimeout(r, 400));
      }

      // 2. Send to deep-scan API
      const result = await ApiService.deepScanChats(chatsWithMessages);

      // Update progress from result
      setScanProgress(result.scan_metadata?.per_chat || []);
      setActiveScanIdx(-1);

      const newOrders: DetectedOrder[] = result.detected_orders || [];
      // Merge new orders with persisted, deduplicating by chat_id+item+quantity
      const allFingerprints = new Set(newOrders.map(o => `${o.chat_id}|${o.item}|${o.quantity}`));
      const stillPending = persistedOrders.filter(
        o => !allFingerprints.has(`${o.chat_id}|${o.item}|${o.quantity}`)
      );
      setDetectedOrders(newOrders);
      setPersistedOrders(stillPending);
      setScanMeta(result.scan_metadata);
      setTraceLogs(prev => [
        ...prev,
        `[System1] ✅ Scan complete.`,
        `[System1] 📊 ${result.scan_metadata?.new_messages_scanned} new messages read across ${result.scan_metadata?.total_chats} chats.`,
        `[System1] 🎯 ${(result.detected_orders || []).length} pending order(s) detected.`,
      ]);

      // Reload scan state/history
      await loadScanState();
    } catch (e: any) {
      setTraceLogs(prev => [...prev, `[System1] ❌ Error: ${e.message}`]);
      Alert.alert('Scan Error', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = async (order: DetectedOrder) => {
    try {
      // Dynamically match the item name against actual database products
      let productId: string | number = 1;
      let warehouseId: number = order.warehouse_id || 1;
      try {
        const dbProducts = await ApiService.getProducts();
        const normalizedOrderItem = order.item.toLowerCase().trim();
        const matchedProduct = dbProducts.find(
          (p: any) =>
            p.name.toLowerCase().trim() === normalizedOrderItem ||
            (p.sku && p.sku.toLowerCase().trim() === normalizedOrderItem)
        );
        if (matchedProduct) {
          productId = matchedProduct.id;
          if (matchedProduct.warehouse_id) warehouseId = matchedProduct.warehouse_id;
        } else {
          const partialMatch = dbProducts.find(
            (p: any) =>
              p.name.toLowerCase().includes(normalizedOrderItem) ||
              normalizedOrderItem.includes(p.name.toLowerCase())
          );
          if (partialMatch) {
            productId = partialMatch.id;
            if (partialMatch.warehouse_id) warehouseId = partialMatch.warehouse_id;
          } else if (dbProducts.length > 0) {
            productId = dbProducts[0].id;
          }
        }
      } catch (prodErr) {
        console.warn('Failed to fetch products for dynamic mapping, using default ID 1', prodErr);
      }

      const txType = order.type === 'SALE' ? 'sale' : 'restock';

      await ApiService.recordTransaction(txType, {
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: order.quantity || 1,
        value: order.value || 0,
      });

      // ── KEY FIX: Also create a real Order record so it appears in ERP Hub Orders tab ──
      await ApiService.addOrder({
        customer_name: order.contact_name || 'Brain Auto-Approved',
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: order.quantity || 1,
        unit_price: order.value ? order.value / (order.quantity || 1) : 0,
        total_value: order.value || 0,
        order_ref: `BRAIN-${order.type}-${Date.now()}`,
      });

      // Remove from both local state lists
      const match = (o: DetectedOrder) => o.chat_id === order.chat_id && o.item === order.item && o.quantity === order.quantity;
      setDetectedOrders(prev => prev.filter(o => !match(o)));
      setPersistedOrders(prev => prev.filter(o => !match(o)));

      // Remove from Firestore
      const fp = (order as any).fingerprint;
      if (fp) await ApiService.deletePendingOrder(fp);

      setTraceLogs(prev => [...prev, `[System1] ✅ Booked: ${order.quantity} × ${order.item} (${order.type}) from ${order.contact_name}`]);
      Alert.alert('✅ Order Booked', `${order.quantity} units of ${order.item} logged to the ERP ledger and visible in Orders tab.`);
    } catch (e: any) {
      Alert.alert('Booking Error', e.message);
    }
  };

  // ── Reject ───────────────────────────────────────────────────────────────
  const handleReject = async (order: DetectedOrder) => {
    try {
      await ApiService.rejectOrder({
        chat_id: order.chat_id,
        item: order.item,
        quantity: order.quantity,
        type: order.type,
      });

      // Remove from both local state lists
      const match = (o: DetectedOrder) => o.chat_id === order.chat_id && o.item === order.item && o.quantity === order.quantity;
      setDetectedOrders(prev => prev.filter(o => !match(o)));
      setPersistedOrders(prev => prev.filter(o => !match(o)));

      // Remove from Firestore
      const fp = (order as any).fingerprint;
      if (fp) await ApiService.deletePendingOrder(fp);

      setTraceLogs(prev => [...prev, `[System1] ❌ Rejected: ${order.item} from ${order.contact_name}`]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // ── Manual Send ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!message.trim()) return;
    setIsLoading(true);
    setTraceLogs([]);
    try {
      const data = await ApiService.sendOrder(message);
      setTraceLogs(data.trace_logs);
      setMessage('');
    } catch (e: any) {
      setTraceLogs([`Error: ${e.message}`]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Voice ────────────────────────────────────────────────────────────────
  const handleVoice = async () => {
    try {
      const { Audio } = await import('expo-av');
      if (isRecording && recordingRef.current) {
        setIsRecording(false);
        micPulse.stopAnimation(); micPulse.setValue(1);
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        if (!uri) return;
        const blob = await (await fetch(uri)).blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = (reader.result as string).split(',')[1];
          const res = await fetch('http://localhost:8000/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_base64: b64, mime_type: 'audio/wav' }),
          });
          const d = await res.json();
          if (d.transcript) setMessage(d.transcript);
        };
        reader.readAsDataURL(blob);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) { Alert.alert('Microphone Permission Required'); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true);
        Animated.loop(Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
        ])).start();
      }
    } catch (e: any) {
      setIsRecording(false);
    }
  };

  const totalMsgsScanned = scanMeta?.total_messages_scanned ?? 0;
  const newMsgsScanned   = scanMeta?.new_messages_scanned   ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <View style={styles.agentStatus}>
          <Animated.View style={[styles.agentDot, { transform: [{ scale: agentDotPulse }] }]} />
          <Text style={styles.agentLabel}>SYSTEM 1 · CUSTOMER BRAIN · LIVE</Text>
        </View>
        <Text style={styles.title}>Order Intelligence</Text>
        <Text style={styles.subtitle}>Autonomous Chat-to-ERP Agent</Text>
      </Animated.View>

      {/* ── Scan State Summary ──────────────────────────────────────────────── */}
      {scanState && (
        <View style={styles.stateCard}>
          <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={styles.stateRow}>
            <View style={styles.stateMeta}>
              <Text style={styles.stateLabel}>CHATS TRACKED</Text>
              <Text style={styles.stateValue}>{Object.keys(scanState.cursors || {}).length}</Text>
            </View>
            <View style={styles.stateMeta}>
              <Text style={styles.stateLabel}>PAST SESSIONS</Text>
              <Text style={styles.stateValue}>{sessions.length}</Text>
            </View>
            <View style={styles.stateMeta}>
              <Text style={styles.stateLabel}>LAST SCAN</Text>
              <Text style={styles.stateValue}>
                {sessions[0]
                  ? new Date(sessions[0].scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowTrackedChats(!showTrackedChats);
                  if (!showTrackedChats) setShowHistory(false);
                }}
                style={[styles.historyBtn, showTrackedChats && { borderColor: Theme.colors.primary, backgroundColor: 'rgba(0,230,118,0.08)' }]}
              >
                <ScanLine size={14} color={showTrackedChats ? Theme.colors.primary : Theme.colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowHistory(!showHistory);
                  if (!showHistory) setShowTrackedChats(false);
                }}
                style={[styles.historyBtn, showHistory && { borderColor: Theme.colors.primary, backgroundColor: 'rgba(0,230,118,0.08)' }]}
              >
                <History size={14} color={showHistory ? Theme.colors.primary : Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Tracked Chats (Cursors) ──────────────────────────────────────────── */}
      {showTrackedChats && scanState?.cursors && (
        <View style={styles.historyCard}>
          <LinearGradient colors={['rgba(17,22,34,0.95)', 'rgba(7,10,14,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm }}>
            <Text style={styles.historyTitle}>Tracked Chat Cursors</Text>
            {Object.keys(scanState.cursors).length > 0 && (
              <TouchableOpacity onPress={handleResetAllCursors}>
                <Text style={{ color: Theme.colors.error, fontSize: 11, fontWeight: '700' }}>Reset All</Text>
              </TouchableOpacity>
            )}
          </View>
          {Object.keys(scanState.cursors).length === 0 ? (
            <Text style={{ color: Theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 }}>
              No chats currently tracked. Run a scan to build cursors.
            </Text>
          ) : (
            Object.entries(scanState.cursors).map(([chatId, cursor]: [string, any]) => (
              <View key={chatId} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: Theme.colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTime}>{cursor.contact_name || chatId}</Text>
                  <Text style={styles.historyMeta}>
                    Last Msg: {cursor.last_scanned_message_id?.slice(0, 8) || 'None'} · Scanned: {cursor.messages_scanned || 0} msgs
                  </Text>
                  {cursor.updated_at && (
                    <Text style={{ color: Theme.colors.textMuted, fontSize: 9, marginTop: 2 }}>
                      Last Scanned: {new Date(cursor.updated_at).toLocaleString()}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteCursor(chatId)} style={{ padding: 4 }}>
                  <Trash2 size={14} color={Theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── Session History ─────────────────────────────────────────────────── */}
      {showHistory && sessions.length > 0 && (
        <View style={styles.historyCard}>
          <LinearGradient colors={['rgba(17,22,34,0.95)', 'rgba(7,10,14,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm }}>
            <Text style={styles.historyTitle}>Scan History</Text>
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={{ color: Theme.colors.error, fontSize: 11, fontWeight: '700' }}>Clear All</Text>
            </TouchableOpacity>
          </View>
          {sessions.map((s, i) => (
            <View key={s.session_id || i} style={styles.historyRow}>
              <View style={styles.historyDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTime}>{new Date(s.scanned_at).toLocaleString()}</Text>
                <Text style={styles.historyMeta}>
                  {s.total_chats} chats · {s.new_messages_scanned} msgs · {s.orders_detected} orders found
                </Text>
              </View>
              {s.session_id && (
                <TouchableOpacity onPress={() => handleDeleteSession(s.session_id!)} style={{ padding: 4 }}>
                  <Trash2 size={14} color={Theme.colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── RUN AGENT Button ────────────────────────────────────────────────── */}
      <View style={styles.runBtnWrap}>
        {isScanning && (
          <>
            <Animated.View style={[styles.runBtnRing, styles.runBtnRing1, {
              opacity: agentDotPulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.4, 0] }),
              transform: [{ scale: agentDotPulse.interpolate({ inputRange: [1, 1.5], outputRange: [1, 1.6] }) }],
            }]} />
            <Animated.View style={[styles.runBtnRing, styles.runBtnRing2, {
              opacity: agentDotPulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.25, 0] }),
              transform: [{ scale: agentDotPulse.interpolate({ inputRange: [1, 1.5], outputRange: [1, 2.2] }) }],
            }]} />
          </>
        )}
        <TouchableOpacity
          style={[styles.runBtn, isScanning && styles.runBtnDisabled]}
          onPress={handleRunAgent}
          disabled={isScanning}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isScanning ? ['rgba(0,230,118,0.15)', 'rgba(0,230,118,0.05)'] : Theme.gradients.primary}
            style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.xl }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          {isScanning ? (
            <><ActivityIndicator size="small" color={Theme.colors.primary} />
              <Text style={[styles.runBtnText, { color: Theme.colors.primary }]}>Scanning Chats...</Text></>
          ) : (
            <><Play size={20} color="#000" />
              <Text style={styles.runBtnText}>Run System 1 Agent</Text></>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Scan Progress ───────────────────────────────────────────────────── */}
      {(isScanning || scanProgress.length > 0) && (
        <View style={styles.progressCard}>
          <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
          <View style={styles.progressHeader}>
            <ScanLine size={14} color={Theme.colors.primary} />
            <Text style={styles.progressTitle}>
              {isScanning ? 'Scanning in progress...' : `Scan complete — ${scanMeta?.new_messages_scanned ?? 0} new messages`}
            </Text>
          </View>
          {scanProgress.map((chat, i) => (
            <ScanProgressItem key={chat.chat_id} chat={chat} isActive={isScanning && i === activeScanIdx} />
          ))}
          {scanMeta && (
            <View style={styles.scanSummaryRow}>
              <Text style={styles.scanSummaryText}>
                📊 {scanMeta.total_chats} chats · {newMsgsScanned} new msgs · {detectedOrders.length} orders detected
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Persisted (Last Scan) Pending Orders ─────────────────────────────── */}
      {isLoadingPersisted && (
        <View style={styles.loadingPersistedRow}>
          <ActivityIndicator size="small" color={Theme.colors.primary} />
          <Text style={styles.loadingPersistedText}>Loading pending orders from last scan...</Text>
        </View>
      )}

      {!isLoadingPersisted && persistedOrders.length > 0 && (
        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <Clock size={18} color="#00B0FF" />
            <Text style={[styles.ordersSectionTitle, { color: '#00B0FF' }]}>
              {persistedOrders.length} Pending from Last Scan
            </Text>
          </View>
          <View style={styles.lastScanBanner}>
            <LinearGradient colors={['rgba(0,176,255,0.1)', 'rgba(0,176,255,0.04)']} style={StyleSheet.absoluteFill} />
            <Text style={styles.lastScanBannerText}>
              🕐 These orders were detected in your previous scan and haven't been actioned yet.
              They will remain here until you Approve or Reject them.
            </Text>
          </View>
          {persistedOrders.map((order, i) => (
            <OrderCard
              key={`persisted-${order.chat_id}-${order.item}-${i}`}
              order={{...order, _fromLastScan: true} as any}
              index={i}
              onApprove={() => handleApprove(order)}
              onReject={() => handleReject(order)}
              onSave={(updated) => handleSave(order, updated)}
            />
          ))}
        </View>
      )}

      {/* ── Detected Orders (Current Scan) ───────────────────────────────────── */}
      {detectedOrders.length > 0 && (
        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <AlertCircle size={18} color={Theme.colors.warning} />
            <Text style={styles.ordersSectionTitle}>
              {detectedOrders.length} New Order{detectedOrders.length !== 1 ? 's' : ''} Detected
            </Text>
          </View>
          {detectedOrders.map((order, i) => (
            <OrderCard
              key={`${order.chat_id}-${order.item}-${i}`}
              order={order}
              index={i}
              onApprove={() => handleApprove(order)}
              onReject={() => handleReject(order)}
              onSave={(updated) => handleSave(order, updated)}
            />
          ))}
        </View>
      )}

      {!isScanning && !isLoadingPersisted && detectedOrders.length === 0 && persistedOrders.length === 0 && scanMeta && (
        <View style={styles.allClearCard}>
          <LinearGradient colors={['rgba(0,230,118,0.06)', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.allClearEmoji}>✅</Text>
          <Text style={styles.allClearTitle}>All Clear</Text>
          <Text style={styles.allClearSub}>No unbooked orders detected in your chats.</Text>
        </View>
      )}

      {/* ── Manual Override ──────────────────────────────────────────────────── */}
      <View style={styles.manualSection}>
        <Text style={styles.manualTitle}>Manual Command Override</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type an order command... (e.g. 'I need 5kg milk')"
            placeholderTextColor={Theme.colors.textMuted}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={handleSend}
          />
          <Animated.View style={{ transform: [{ scale: micPulse }] }}>
            <TouchableOpacity style={[styles.iconBtn, isRecording && styles.iconBtnActive]} onPress={handleVoice}>
              {isRecording ? <MicOff size={18} color="#FF4444" /> : <Mic size={18} color={Theme.colors.textMuted} />}
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#000" size="small" /> : <Send size={18} color="#000" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Trace Terminal ───────────────────────────────────────────────────── */}
      {traceLogs.length > 0 && (
        <View style={styles.terminalCard}>
          <LinearGradient colors={['rgba(0,0,0,0.9)', 'rgba(7,10,14,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={styles.terminalBar}>
            <View style={styles.terminalDots}>
              <View style={[styles.terminalDot, { backgroundColor: '#FF5F57' }]} />
              <View style={[styles.terminalDot, { backgroundColor: '#FEBC2E' }]} />
              <View style={[styles.terminalDot, { backgroundColor: '#28C840' }]} />
            </View>
            <Text style={styles.terminalBarText}>SYSTEM 1 · TRACE LOG</Text>
          </View>
          {traceLogs.map((log, i) => (
            <Text key={i} style={[styles.logLine, log.includes('❌') && { color: Theme.colors.error }, log.includes('✅') && { color: Theme.colors.primary }]}>
              {log}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  contentContainer: { padding: Theme.spacing.md, paddingBottom: Theme.spacing.xxl * 2 },

  // Header
  header: { marginBottom: Theme.spacing.lg },
  agentStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  agentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.primary },
  agentLabel: { color: Theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#FFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: Theme.colors.textMuted, fontSize: 13, marginTop: 2 },

  // State summary card
  stateCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateMeta: { alignItems: 'center' },
  stateLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  stateValue: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  historyBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  // History
  historyCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  historyTitle: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: Theme.spacing.sm },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Theme.colors.primary, marginTop: 5 },
  historyTime: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  historyMeta: { color: Theme.colors.textMuted, fontSize: 11 },

  // Run Button
  runBtn: { height: 58, borderRadius: Theme.borderRadius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: Theme.spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: Theme.colors.primary },
  runBtnDisabled: { borderColor: 'rgba(0,230,118,0.3)' },
  runBtnText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  // Scan Progress
  progressCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Theme.spacing.md },
  progressTitle: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  progressItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  progressChatName: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  progressMeta: { color: Theme.colors.textMuted, fontSize: 10, marginTop: 1 },
  progressCheck: { fontSize: 14, color: Theme.colors.textMuted, fontWeight: '700' },
  scanSummaryRow: { paddingTop: Theme.spacing.sm, marginTop: Theme.spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  scanSummaryText: { color: Theme.colors.primary, fontSize: 12, fontWeight: '700' },

  // Orders Section
  ordersSection: { marginBottom: Theme.spacing.lg },
  ordersSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Theme.spacing.md },
  ordersSectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  orderCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  cardTop: { marginBottom: Theme.spacing.sm },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  typePillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  confPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  confPillText: { fontSize: 9, fontWeight: '800' },
  contactName: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  chatIdText: { color: Theme.colors.textMuted, fontSize: 10, marginTop: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: Theme.borderRadius.md, padding: Theme.spacing.sm, marginBottom: Theme.spacing.sm },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  statValue: { color: '#FFF', fontSize: 15, fontWeight: '900' },

  reasonBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Theme.colors.primaryGlow, borderRadius: Theme.borderRadius.sm, padding: Theme.spacing.sm, marginBottom: Theme.spacing.sm },
  reasonText: { color: Theme.colors.primary, fontSize: 12, flex: 1, fontStyle: 'italic', lineHeight: 18 },

  sourceToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 4 },
  sourceToggleText: { color: Theme.colors.textMuted, fontSize: 11, flex: 1 },
  sourceBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Theme.borderRadius.sm, padding: Theme.spacing.sm, marginBottom: Theme.spacing.sm, borderLeftWidth: 2, borderLeftColor: Theme.colors.border },
  sourceText: { color: Theme.colors.textMuted, fontSize: 12, fontStyle: 'italic', lineHeight: 17 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  approveBtn: { flex: 2, height: 44, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  approveBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  rejectBtn: { flex: 1, height: 44, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,42,85,0.1)', borderWidth: 1, borderColor: 'rgba(255,42,85,0.4)' },
  rejectBtnText: { color: Theme.colors.error, fontWeight: '800', fontSize: 13 },

  // All Clear
  allClearCard: { borderRadius: Theme.borderRadius.xl, borderWidth: 1, borderColor: Theme.colors.primary, padding: Theme.spacing.xl, alignItems: 'center', marginBottom: Theme.spacing.lg, overflow: 'hidden' },
  allClearEmoji: { fontSize: 40, marginBottom: 10 },
  allClearTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  allClearSub: { color: Theme.colors.textMuted, fontSize: 13, textAlign: 'center' },

  // Manual
  manualSection: { marginBottom: Theme.spacing.md },
  manualTitle: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: Theme.spacing.sm },
  inputRow: { flexDirection: 'row', gap: 8, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, padding: 6, borderWidth: 1, borderColor: Theme.colors.border },
  input: { flex: 1, height: 46, paddingHorizontal: Theme.spacing.sm, color: '#FFF', fontSize: 14 },
  iconBtn: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: Theme.borderRadius.md },
  iconBtnActive: { backgroundColor: 'rgba(255,68,68,0.1)' },
  sendBtn: { width: 46, height: 46, borderRadius: Theme.borderRadius.md, backgroundColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center' },

  // Terminal
  terminalCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: '#1E2D1A', padding: 0, overflow: 'hidden', marginBottom: Theme.spacing.md },
  terminalBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  terminalDots: { flexDirection: 'row', gap: 5 },
  terminalDot: { width: 10, height: 10, borderRadius: 5 },
  terminalBarText: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  logLine: { color: '#6EE78A', fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 14, paddingVertical: 2, lineHeight: 20 },

  // Persisted orders
  loadingPersistedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: Theme.spacing.md },
  loadingPersistedText: { color: Theme.colors.textMuted, fontSize: 13 },
  lastScanBanner: { borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: 'rgba(0,176,255,0.2)', padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  lastScanBannerText: { color: '#00B0FF', fontSize: 12, lineHeight: 18 },

  editFieldsContainer: {
    padding: Theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.sm,
  },
  editFieldRow: {
    marginBottom: 10,
  },
  editFieldRowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editFieldLabel: {
    color: Theme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardInput: {
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    color: '#FFF',
    fontSize: 14,
  },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: Theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  editBtnText: {
    color: Theme.colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  typeSelectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  typeSelectBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: Theme.colors.textMuted,
  },

  runBtnWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  runBtnRing1: {
    position: 'absolute',
    width: '100%',
    height: 56,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
  },
  runBtnRing2: {
    position: 'absolute',
    width: '100%',
    height: 56,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
  },
  runBtnRing: {},
});
