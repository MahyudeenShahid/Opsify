import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, FlatList, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Send, Zap, Activity, ScanLine, ShoppingCart, ArrowDownToLine, PackageSearch, Mic, MicOff } from 'lucide-react-native';

import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { TraceTerminal } from '../widgets/TraceTerminal';
import { FirebaseChatService } from '../services/firebaseChatService';

interface IncompleteOrder {
  chat_id: string;
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT';
  contact_name: string;
  item: 'Milk' | 'Wire' | 'Pipe' | 'Bread';
  quantity: number;
  value: number;
  warehouse_id: number;
  reason: string;
}

export const CustomerBrainScreen: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  
  const [incompleteOrders, setIncompleteOrders] = useState<IncompleteOrder[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<any>(null);
  const micPulse = useRef(new Animated.Value(1)).current;

  // Animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(headerTranslateY, { toValue: 0, friction: 6, useNativeDriver: true })
    ]).start();

    handleScanChats();
  }, []);

  const _startMicPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  };

  const handleVoice = async () => {
    try {
      const { Audio } = await import('expo-av');
      if (isRecording && recordingRef.current) {
        // ── Stop & transcribe ────────────────────────────────────────────
        setIsRecording(false);
        micPulse.stopAnimation();
        micPulse.setValue(1);
        setStatus('Transcribing voice...');
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        if (!uri) return;

        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const result = await fetch(
              'http://localhost:8000/api/voice/transcribe',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_base64: base64, mime_type: 'audio/wav', language_hint: 'en' }),
              }
            );
            const data = await result.json();
            if (data.transcript) {
              setMessage(data.transcript);
              setStatus('Voice transcribed ✅');
            } else {
              setStatus('Could not transcribe audio. Please try again.');
            }
          } catch (e: any) {
            setStatus(`Transcription error: ${e.message}`);
          }
        };
        reader.readAsDataURL(blob);

      } else {
        // ── Start recording ──────────────────────────────────────────────
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Microphone Permission', 'Please allow microphone access in device settings.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
        setStatus('Recording... tap mic to stop.');
        _startMicPulse();
      }
    } catch (e: any) {
      setIsRecording(false);
      setStatus(`Voice error: ${e.message}`);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsLoading(true);
    setTraceLogs([]);
    setStatus('Running Antigravity Graph...');

    try {
      const data = await ApiService.sendOrder(message);
      setStatus(data.execution_status);
      setTraceLogs(data.trace_logs);
      handleScanChats();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
      setMessage('');
    }
  };

  const handleScanChats = async () => {
    setIsScanning(true);
    try {
      // Try fetching real Firebase chats first
      let chatsPayload: any[] = [];
      try {
        await new Promise<void>((resolve) => {
          const unsub = FirebaseChatService.subscribeToChats('demo-user-id', (fetchedChats) => {
            chatsPayload = fetchedChats.map((chat) => ({
              id: chat.id,
              users: (chat.users || []).map((u: any) => ({ name: u.name })),
              messages: [{ text: chat.lastMessage || '' }],
            }));
            unsub();
            resolve();
          });
        });
      } catch (_) {
        // Firebase not configured — use demo payload
      }

      // Ensure at least demo chats if nothing loaded
      if (chatsPayload.length === 0) {
        chatsPayload = [
          { id: 'chat_alice', users: [{ name: 'Alice (Dairy Supplier)' }], messages: [{ text: 'Hi, did you get the dairy reorder request?' }] },
          { id: 'chat_bob',   users: [{ name: 'Bob Malone (Hardware Buyer)' }], messages: [{ text: 'Hey, can I buy 50 meters of Copper Wire?' }] },
        ];
      }

      const orders = await ApiService.scanChats(chatsPayload);
      setIncompleteOrders(orders);
    } catch (e) {
      console.error('[ChatScanner]', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleBookOrder = async (order: IncompleteOrder) => {
    try {
      const categoryToProductId: Record<string, number> = { 'Milk': 1, 'Wire': 2, 'Pipe': 3, 'Bread': 4 };
      const productId = categoryToProductId[order.item] || 1;
      const txType = order.type === 'SALE' ? 'sale' : 'restock';

      await ApiService.recordTransaction(txType, {
        product_id: productId,
        warehouse_id: order.warehouse_id || 1,
        quantity: order.quantity,
        value: order.value
      });

      Alert.alert("⚡ Transaction Booked", `Successfully logged ${order.quantity} units of ${order.item}!`);
      setIncompleteOrders(prev => prev.filter(o => o.chat_id !== order.chat_id));
      ApiService.syncSheets().catch(e => console.log(e));
    } catch (e: any) {
      Alert.alert("Booking Error", e.message);
    }
  };

  const renderIncompleteOrder = ({ item, index }: { item: IncompleteOrder, index: number }) => {
    return <OrderCard item={item} index={index} onBook={() => handleBookOrder(item)} />;
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerTranslateY }] }]}>
        <View style={styles.headerTitleRow}>
          <Activity color={Theme.colors.primary} size={28} />
          <Text style={styles.title}>System 1 Brain</Text>
        </View>
        <Text style={styles.subtitle}>Autonomous Interaction Engine</Text>
      </Animated.View>

      <View style={styles.inputCard}>
        <TextInput
          style={styles.input}
          placeholder="Manual command override..."
          placeholderTextColor={Theme.colors.textMuted}
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={handleSend}
        />
        {/* Voice Input Button */}
        <Animated.View style={{ transform: [{ scale: micPulse }] }}>
          <TouchableOpacity
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPress={handleVoice}
          >
            {isRecording ? <MicOff color="#FF4444" size={18} /> : <Mic color={Theme.colors.textMuted} size={18} />}
          </TouchableOpacity>
        </Animated.View>
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#000" /> : <Send color="#000" size={20} />}
        </TouchableOpacity>
      </View>

      <View style={styles.scanSection}>
        <View style={styles.scanHeader}>
          <View style={styles.scanTitleRow}>
            <ScanLine color={Theme.colors.warning} size={18} />
            <Text style={styles.sectionTitle}>Agentic Order Scans</Text>
          </View>
          <TouchableOpacity style={styles.scanButton} onPress={handleScanChats} disabled={isScanning}>
            {isScanning ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <Text style={styles.scanButtonText}>Re-Scan</Text>}
          </TouchableOpacity>
        </View>

        {incompleteOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <PackageSearch color={Theme.colors.border} size={48} />
            <Text style={styles.emptyText}>No pending drafts detected in live chats.</Text>
          </View>
        ) : (
          <FlatList
            data={incompleteOrders}
            keyExtractor={item => item.chat_id}
            renderItem={renderIncompleteOrder}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.orderList}
          />
        )}
      </View>

      <View style={styles.terminalContainer}>
        <View style={styles.terminalHeader}>
          <Text style={styles.terminalHeaderText}>LIVE TRACE LOGS</Text>
        </View>
        <TraceTerminal logs={traceLogs} />
      </View>
    </View>
  );
};

// Animated Card Component
const OrderCard = ({ item, index, onBook }: { item: IncompleteOrder, index: number, onBook: () => void }) => {
  const isSale = item.type === 'SALE';
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 150, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, delay: index * 150, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.orderCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient colors={Theme.gradients.surface} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.lg }]} />
      
      <View style={styles.cardHeader}>
        <Text style={styles.contactName}>{item.contact_name}</Text>
        <View style={[styles.typeBadge, isSale ? styles.saleBadge : styles.restockBadge]}>
          {isSale ? <ShoppingCart size={12} color="#00FFA3" /> : <ArrowDownToLine size={12} color="#FFB800" />}
          <Text style={[styles.badgeText, isSale ? { color: '#00FFA3' } : { color: '#FFB800' }]}>
            {item.type}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>ITEM</Text>
          <Text style={styles.statValue}>{item.item}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>QTY</Text>
          <Text style={styles.statValue}>{item.quantity}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>TOTAL</Text>
          <Text style={styles.statValue}>Rs {item.value}</Text>
        </View>
      </View>

      <View style={styles.reasonBox}>
        <Zap color={Theme.colors.primary} size={14} style={{ marginRight: 6 }} />
        <Text style={styles.reasonText}>"{item.reason}"</Text>
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={onBook} style={{ borderRadius: Theme.borderRadius.md, overflow: 'hidden' }}>
        <LinearGradient 
          colors={isSale ? Theme.gradients.success : Theme.gradients.secondary} 
          start={{x:0,y:0}} end={{x:1,y:0}} 
          style={styles.bookBtn}
        >
          <Text style={styles.bookBtnText}>{isSale ? "Execute Sale Order" : "Approve Restock"}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: Theme.spacing.md },
  header: { marginBottom: Theme.spacing.md, marginTop: Theme.spacing.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { color: '#FFF', fontSize: 28, fontWeight: '900', marginLeft: 8, letterSpacing: 1 },
  subtitle: { color: Theme.colors.primary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginLeft: 36 },
  
  inputCard: { flexDirection: 'row', backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, padding: 6, borderWidth: 1, borderColor: Theme.colors.border, marginBottom: Theme.spacing.lg, ...Theme.shadows.glass },
  input: { flex: 1, height: 48, paddingHorizontal: Theme.spacing.md, color: '#FFF', fontSize: 15 },
  micButton: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  micButtonActive: { backgroundColor: 'rgba(255,68,68,0.1)', borderRadius: Theme.borderRadius.md },
  sendButton: { width: 48, height: 48, borderRadius: Theme.borderRadius.md, backgroundColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  
  scanSection: { flex: 0.6, marginBottom: Theme.spacing.md },
  scanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  scanTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  scanButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(0,240,255,0.1)', borderRadius: Theme.borderRadius.pill, borderWidth: 1, borderColor: Theme.colors.primary },
  scanButtonText: { color: Theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.xl, borderWidth: 1, borderColor: Theme.colors.border, borderStyle: 'dashed' },
  emptyText: { color: Theme.colors.textMuted, marginTop: 12, fontSize: 13 },
  
  orderList: { paddingBottom: Theme.spacing.sm },
  orderCard: { padding: Theme.spacing.md, borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, marginBottom: Theme.spacing.sm, ...Theme.shadows.glass },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  contactName: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: Theme.borderRadius.pill, borderWidth: 1 },
  saleBadge: { backgroundColor: 'rgba(0,255,163,0.1)', borderColor: 'rgba(0,255,163,0.3)' },
  restockBadge: { backgroundColor: 'rgba(255,184,0,0.1)', borderColor: 'rgba(255,184,0,0.3)' },
  badgeText: { fontSize: 10, fontWeight: 'bold', marginLeft: 4 },
  
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Theme.spacing.md, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: Theme.borderRadius.md, padding: Theme.spacing.sm },
  statBox: { alignItems: 'center', flex: 1 },
  statLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  statValue: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  
  reasonBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.primaryGlow, padding: Theme.spacing.sm, borderRadius: Theme.borderRadius.sm, marginBottom: Theme.spacing.md },
  reasonText: { color: Theme.colors.primary, fontSize: 12, flex: 1, fontStyle: 'italic' },
  
  bookBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  
  terminalContainer: { flex: 0.4, backgroundColor: Theme.colors.terminalBg, borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.terminalBorder, overflow: 'hidden' },
  terminalHeader: { backgroundColor: Theme.colors.terminalBorder, paddingVertical: 6, paddingHorizontal: 12 },
  terminalHeaderText: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }
});
