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
  Send, Mic, MicOff, RefreshCw, History, AlertCircle
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
}: {
  order: DetectedOrder;
  index: number;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const slideY = useRef(new Animated.Value(40)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, friction: 7, delay: index * 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const isSale    = order.type === 'SALE';
  const isRestock = order.type === 'RESTOCK';
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
            <View style={[styles.typePill, { backgroundColor: `${typeColor}15`, borderColor: typeColor }]}>
              <Text style={[styles.typePillText, { color: typeColor }]}>{order.type}</Text>
            </View>
            <View style={[styles.confPill, { backgroundColor: confCfg.bg, borderColor: confCfg.color }]}>
              <Text style={[styles.confPillText, { color: confCfg.color }]}>{conf}</Text>
            </View>
          </View>
          <Text style={styles.contactName}>{order.contact_name}</Text>
          <Text style={styles.chatIdText}>chat: {order.chat_id.slice(0, 20)}…</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>ITEM</Text>
          <Text style={[styles.statValue, { color: typeColor }]}>{order.item}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>QTY</Text>
          <Text style={styles.statValue}>{order.quantity}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>VALUE</Text>
          <Text style={[styles.statValue, { color: Theme.colors.secondary }]}>Rs {order.value.toFixed(0)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>WH</Text>
          <Text style={styles.statValue}>#{order.warehouse_id}</Text>
        </View>
      </View>

      {/* AI Reason */}
      <View style={styles.reasonBox}>
        <Zap size={12} color={Theme.colors.primary} />
        <Text style={styles.reasonText}>{order.reason}</Text>
      </View>

      {/* Source Message Toggle */}
      {order.source_message ? (
        <TouchableOpacity style={styles.sourceToggle} onPress={() => setShowSource(!showSource)}>
          <MessageSquare size={12} color={Theme.colors.textMuted} />
          <Text style={styles.sourceToggleText}>Source message</Text>
          {showSource ? <ChevronUp size={12} color={Theme.colors.textMuted} /> : <ChevronDown size={12} color={Theme.colors.textMuted} />}
        </TouchableOpacity>
      ) : null}
      {showSource && order.source_message ? (
        <View style={styles.sourceBox}>
          <Text style={styles.sourceText}>"{order.source_message}"</Text>
        </View>
      ) : null}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.approveBtn} onPress={onApprove}>
          <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          <CheckCircle size={16} color="#000" />
          <Text style={styles.approveBtnText}>Approve & Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
          <XCircle size={16} color={Theme.colors.error} />
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
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
  const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null);
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [scanState, setScanState] = useState<any>(null);

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

      setDetectedOrders(result.detected_orders || []);
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
      const ITEM_TO_PRODUCT: Record<string, number> = {
        Milk: 1, Wire: 2, 'Copper Wire': 2, Pipe: 3, Bread: 4,
      };
      const productId = ITEM_TO_PRODUCT[order.item] || 1;
      const txType = order.type === 'SALE' ? 'sale' : 'restock';

      await ApiService.recordTransaction(txType, {
        product_id: productId,
        warehouse_id: order.warehouse_id || 1,
        quantity: order.quantity,
        value: order.value,
      });

      setDetectedOrders(prev => prev.filter(o => !(o.chat_id === order.chat_id && o.item === order.item && o.quantity === order.quantity)));
      setTraceLogs(prev => [...prev, `[System1] ✅ Booked: ${order.quantity} × ${order.item} (${order.type}) from ${order.contact_name}`]);
      Alert.alert('✅ Order Booked', `${order.quantity} units of ${order.item} logged to the ERP ledger.`);
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
      setDetectedOrders(prev => prev.filter(o => !(o.chat_id === order.chat_id && o.item === order.item && o.quantity === order.quantity)));
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
            <TouchableOpacity onPress={() => setShowHistory(!showHistory)} style={styles.historyBtn}>
              <History size={14} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Session History ─────────────────────────────────────────────────── */}
      {showHistory && sessions.length > 0 && (
        <View style={styles.historyCard}>
          <LinearGradient colors={['rgba(17,22,34,0.95)', 'rgba(7,10,14,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.historyTitle}>Scan History</Text>
          {sessions.map((s, i) => (
            <View key={s.session_id || i} style={styles.historyRow}>
              <View style={styles.historyDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTime}>{new Date(s.scanned_at).toLocaleString()}</Text>
                <Text style={styles.historyMeta}>
                  {s.total_chats} chats · {s.new_messages_scanned} msgs · {s.orders_detected} orders found
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── RUN AGENT Button ────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.runBtn, isScanning && styles.runBtnDisabled]}
        onPress={handleRunAgent}
        disabled={isScanning}
      >
        <LinearGradient
          colors={isScanning ? ['rgba(0,230,118,0.2)', 'rgba(0,230,118,0.05)'] : Theme.gradients.primary}
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

      {/* ── Detected Orders ──────────────────────────────────────────────────── */}
      {detectedOrders.length > 0 && (
        <View style={styles.ordersSection}>
          <View style={styles.ordersSectionHeader}>
            <AlertCircle size={18} color={Theme.colors.warning} />
            <Text style={styles.ordersSectionTitle}>
              {detectedOrders.length} Pending Order{detectedOrders.length !== 1 ? 's' : ''} Detected
            </Text>
          </View>
          {detectedOrders.map((order, i) => (
            <OrderCard
              key={`${order.chat_id}-${order.item}-${i}`}
              order={order}
              index={i}
              onApprove={() => handleApprove(order)}
              onReject={() => handleReject(order)}
            />
          ))}
        </View>
      )}

      {!isScanning && detectedOrders.length === 0 && scanMeta && (
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
});
