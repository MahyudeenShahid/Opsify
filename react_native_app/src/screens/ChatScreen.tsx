import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Animated, Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Send, Bot, User, CheckCircle, XCircle, Package,
  BarChart2, TrendingUp, Zap, RefreshCw,
} from 'lucide-react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionCard?: ActionCard;
}

interface ActionCard {
  action_type: 'RESTOCK' | 'SALE' | 'ADJUSTMENT';
  product_id: number;
  warehouse_id: number;
  quantity?: number;
  quantity_diff?: number;
  reason?: string;
  product_name: string;
  warehouse_name?: string;
  note?: string;
  requires_confirmation: boolean;
}

const QUICK_PROMPTS = [
  { label: '📦 Stock Levels', message: "What's the current stock level for all products?" },
  { label: '📋 Recent Orders', message: 'Show me the last 10 transactions.' },
  { label: '🤝 Suppliers', message: 'List all my suppliers with their ratings.' },
  { label: '⚠️ Low Stock', message: 'Which products need restocking urgently?' },
  { label: '🔍 Find Supplier', message: 'Find nearby suppliers for Milk.' },
];

const ActionCardView: React.FC<{
  card: ActionCard;
  onApprove: (card: ActionCard) => void;
  onDismiss: () => void;
  isLoading: boolean;
}> = ({ card, onApprove, onDismiss, isLoading }) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  }, []);

  const actionColor = {
    RESTOCK: Theme.colors.success,
    SALE: Theme.colors.primary,
    ADJUSTMENT: Theme.colors.warning,
  }[card.action_type];

  const actionIcon = {
    RESTOCK: <Package size={20} color={actionColor} />,
    SALE: <TrendingUp size={20} color={actionColor} />,
    ADJUSTMENT: <RefreshCw size={20} color={actionColor} />,
  }[card.action_type];

  const quantity = card.quantity ?? card.quantity_diff ?? 0;

  return (
    <Animated.View style={[styles.actionCard, { borderColor: actionColor, transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.actionCardHeader}>
        {actionIcon}
        <Text style={[styles.actionCardTitle, { color: actionColor }]}>
          {card.action_type} — Pending Confirmation
        </Text>
      </View>
      <View style={styles.actionInfoRow}>
        <Text style={styles.actionLabel}>Product</Text>
        <Text style={styles.actionValue}>{card.product_name}</Text>
      </View>
      {card.warehouse_name && (
        <View style={styles.actionInfoRow}>
          <Text style={styles.actionLabel}>Warehouse</Text>
          <Text style={styles.actionValue}>{card.warehouse_name}</Text>
        </View>
      )}
      <View style={styles.actionInfoRow}>
        <Text style={styles.actionLabel}>Quantity</Text>
        <Text style={[styles.actionValue, { color: actionColor, fontWeight: '800' }]}>
          {quantity > 0 ? '+' : ''}{quantity} units
        </Text>
      </View>
      {card.reason && (
        <View style={styles.actionInfoRow}>
          <Text style={styles.actionLabel}>Reason</Text>
          <Text style={styles.actionValue}>{card.reason}</Text>
        </View>
      )}
      {card.note && (
        <View style={styles.actionInfoRow}>
          <Text style={styles.actionLabel}>Note</Text>
          <Text style={styles.actionValue}>{card.note}</Text>
        </View>
      )}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionDismissBtn} onPress={onDismiss} disabled={isLoading}>
          <XCircle size={16} color={Theme.colors.error} />
          <Text style={styles.actionDismissBtnText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionApproveBtn, { backgroundColor: actionColor }]} onPress={() => onApprove(card)} disabled={isLoading}>
          {isLoading
            ? <ActivityIndicator size="small" color={Theme.colors.background} />
            : <><CheckCircle size={16} color={Theme.colors.background} /><Text style={styles.actionApproveBtnText}>Confirm</Text></>
          }
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

interface ChatScreenProps {
  onClose?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onClose }) => {

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "👋 I'm **OpsBot**, your Opsify ERP assistant.\n\nI can answer questions about your stock, orders, and suppliers — and I can stage actions like restocking or recording sales, which you confirm before anything changes.\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const typingDot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingDot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typingDot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingDot.stopAnimation();
    }
  }, [isLoading]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || inputText).trim();
    if (!content || isLoading) return;
    setInputText('');

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    scrollToBottom();

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const result = await ApiService.sendChatMessage(history);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text || "I've processed your request.",
        timestamp: new Date(),
        actionCard: result.action_card || undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${e.message}. Please make sure the backend is running.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [inputText, messages, isLoading]);

  const handleActionApprove = async (card: ActionCard) => {
    setIsExecutingAction(true);
    try {
      let res: any;
      if (card.action_type === 'RESTOCK') {
        res = await ApiService.recordTransaction('restock', {
          product_id: card.product_id,
          warehouse_id: card.warehouse_id,
          quantity: card.quantity,
          value: 0,
        });
      } else if (card.action_type === 'SALE') {
        res = await ApiService.recordTransaction('sale', {
          product_id: card.product_id,
          warehouse_id: card.warehouse_id,
          quantity: card.quantity,
          value: 0,
        });
      } else if (card.action_type === 'ADJUSTMENT') {
        res = await ApiService.recordTransaction('adjustment', {
          product_id: card.product_id,
          warehouse_id: card.warehouse_id,
          quantity_diff: card.quantity_diff,
          reason: card.reason || 'Manual adjustment via OpsBot',
        });
      }

      const confirmMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ **Action Executed Successfully!**\n\n${card.action_type} of ${card.quantity ?? card.quantity_diff} units for **${card.product_name}** has been committed to the database.`,
        timestamp: new Date(),
      };
      setMessages(prev => [
        ...prev.map(m => m.actionCard ? { ...m, actionCard: undefined } : m),
        confirmMsg,
      ]);
    } catch (e: any) {
      Alert.alert('Action Failed', e.message);
    } finally {
      setIsExecutingAction(false);
      scrollToBottom();
    }
  };

  const handleActionDismiss = () => {
    setMessages(prev => prev.map(m => m.actionCard ? { ...m, actionCard: undefined } : m));
    const dismissMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: "🚫 Action cancelled. No changes were made to the database.",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, dismissMsg]);
    scrollToBottom();
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    return (
      <View key={msg.id} style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.avatarBot}>
            <Bot size={14} color={Theme.colors.primary} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {/* Render basic markdown-like bold */}
          <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
            {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
          </Text>
          {msg.actionCard && (
            <ActionCardView
              card={msg.actionCard}
              onApprove={handleActionApprove}
              onDismiss={handleActionDismiss}
              isLoading={isExecutingAction}
            />
          )}
          <Text style={[styles.msgTimestamp, isUser && { textAlign: 'right' }]}>
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {isUser && (
          <View style={styles.avatarUser}>
            <User size={14} color={Theme.colors.background} />
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['rgba(0,240,255,0.15)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.botAvatar}>
          <Zap size={18} color={Theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>OpsBot</Text>
          <Text style={styles.headerSubtitle}>Gemini ERP Assistant</Text>
        </View>
        {onClose ? (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <XCircle size={22} color={Theme.colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.statusDot} />
        )}
      </View>

      {/* Quick Prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickPromptsScroll}
        contentContainerStyle={styles.quickPromptsContent}
      >
        {QUICK_PROMPTS.map((p, i) => (
          <TouchableOpacity key={i} style={styles.quickChip} onPress={() => sendMessage(p.message)}>
            <Text style={styles.quickChipText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(renderMessage)}

        {/* Typing Indicator */}
        {isLoading && (
          <View style={[styles.messageRow]}>
            <View style={styles.avatarBot}>
              <Bot size={14} color={Theme.colors.primary} />
            </View>
            <View style={[styles.messageBubble, styles.bubbleBot, styles.typingBubble]}>
              <Animated.View style={{ opacity: typingDot }}>
                <Text style={styles.typingText}>OpsBot is thinking...</Text>
              </Animated.View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <BlurView intensity={30} tint="dark" style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Ask about stock, orders, suppliers..."
          placeholderTextColor={Theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => sendMessage()}
          multiline
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading
            ? <ActivityIndicator size="small" color={Theme.colors.background} />
            : <Send size={18} color={Theme.colors.background} />
          }
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.border, overflow: 'hidden',
  },
  botAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,240,255,0.12)', borderWidth: 1.5,
    borderColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Theme.colors.text, fontWeight: '800', fontSize: 16 },
  headerSubtitle: { color: Theme.colors.textMuted, fontSize: 11 },
  statusDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Theme.colors.success,
    marginLeft: 'auto',
    shadowColor: Theme.colors.success, shadowRadius: 6, shadowOpacity: 0.8,
  },
  // Quick Prompts
  quickPromptsScroll: { flexGrow: 0 },
  quickPromptsContent: { paddingHorizontal: Theme.spacing.md, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  quickChip: {
    backgroundColor: 'rgba(0,240,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,240,255,0.25)',
    borderRadius: Theme.borderRadius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  quickChipText: { color: Theme.colors.primary, fontSize: 12, fontWeight: '600' },
  // Messages
  messagesScroll: { flex: 1 },
  messagesContent: { paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.md, gap: 12 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowUser: { justifyContent: 'flex-end' },
  avatarBot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,240,255,0.12)', borderWidth: 1,
    borderColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarUser: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '78%', borderRadius: 16, padding: Theme.spacing.sm + 4,
    borderWidth: 1,
  },
  bubbleBot: {
    backgroundColor: 'rgba(30,35,55,0.95)', borderColor: Theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: 'rgba(0,240,255,0.12)', borderColor: 'rgba(0,240,255,0.3)',
    borderBottomRightRadius: 4,
  },
  messageText: { color: Theme.colors.text, fontSize: 13.5, lineHeight: 20 },
  messageTextUser: { color: Theme.colors.text },
  msgTimestamp: { color: Theme.colors.textMuted, fontSize: 10, marginTop: 4 },
  // Typing
  typingBubble: { paddingVertical: 12 },
  typingText: { color: Theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm,
    borderTopWidth: 1, borderTopColor: Theme.colors.border,
  },
  input: {
    flex: 1, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.xl,
    borderWidth: 1, borderColor: Theme.colors.border,
    color: Theme.colors.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  // Action Card
  actionCard: {
    marginTop: 12, borderRadius: Theme.borderRadius.lg,
    borderWidth: 1.5, padding: Theme.spacing.sm,
    backgroundColor: 'rgba(10,12,20,0.9)',
  },
  actionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  actionCardTitle: { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  actionInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionLabel: { color: Theme.colors.textMuted, fontSize: 11 },
  actionValue: { color: Theme.colors.text, fontSize: 11, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionDismissBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: Theme.borderRadius.md,
    borderWidth: 1, borderColor: Theme.colors.error,
  },
  actionDismissBtnText: { color: Theme.colors.error, fontWeight: '700', fontSize: 12 },
  actionApproveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: Theme.borderRadius.md,
  },
  actionApproveBtnText: { color: Theme.colors.background, fontWeight: '800', fontSize: 12 },
  closeBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
