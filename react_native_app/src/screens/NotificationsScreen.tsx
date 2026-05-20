import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell, CheckCheck, Package, Users, ShoppingCart,
  Warehouse, AlertTriangle, Zap, X, ChevronLeft,
} from 'lucide-react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'supplier' | 'order' | 'stock' | 'system' | 'alert' | 'procurement';
  read: boolean;
  created_at: string; // ISO string
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; Icon: any }> = {
  supplier:    { color: Theme.colors.primary,   bg: Theme.colors.primaryDeep,           Icon: Users },
  order:       { color: Theme.colors.accent,    bg: 'rgba(0,176,255,0.08)',             Icon: ShoppingCart },
  stock:       { color: Theme.colors.secondary, bg: 'rgba(255,196,0,0.08)',             Icon: Package },
  system:      { color: Theme.colors.textMuted, bg: 'rgba(100,116,139,0.08)',           Icon: Zap },
  alert:       { color: Theme.colors.error,     bg: 'rgba(255,42,85,0.08)',             Icon: AlertTriangle },
  procurement: { color: Theme.colors.purple,    bg: 'rgba(124,58,237,0.08)',            Icon: Warehouse },
};

// ─── Time Helpers ─────────────────────────────────────────────────────────────

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const groupNotifications = (notifs: AppNotification[]) => {
  const now = Date.now();
  const groups: { label: string; items: AppNotification[] }[] = [
    { label: 'Today',     items: [] },
    { label: 'This Week', items: [] },
    { label: 'Earlier',   items: [] },
  ];
  for (const n of notifs) {
    const age = now - new Date(n.created_at).getTime();
    if (age < 86400000)           groups[0].items.push(n);
    else if (age < 604800000)     groups[1].items.push(n);
    else                          groups[2].items.push(n);
  }
  return groups.filter(g => g.items.length > 0);
};

// ─── Notification Card ────────────────────────────────────────────────────────

const NotifCard = ({
  notif,
  index,
  onDismiss,
}: {
  notif: AppNotification;
  index: number;
  onDismiss: () => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(16)).current;
  const scaleX   = useRef(new Animated.Value(1)).current;
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
  const Icon = cfg.Icon;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: Theme.animation.duration.normal,
        delay: index * Theme.animation.duration.stagger,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0, delay: index * Theme.animation.duration.stagger,
        ...Theme.animation.spring,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleX, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={[
      styles.notifCard,
      !notif.read && styles.notifCardUnread,
      { opacity: fadeAnim, transform: [{ translateY: slideY }, { scaleX }] },
    ]}>
      <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
        <Icon size={18} color={cfg.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifTitleRow}>
          <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>
            {notif.title}
          </Text>
          {!notif.read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
        </View>
        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
      </View>
      <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X size={14} color={Theme.colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = () => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, ...Theme.animation.springBouncy, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.emptyState, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.emptyIconCircle}>
        <Bell size={36} color={Theme.colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>All Caught Up</Text>
      <Text style={styles.emptyBody}>No notifications yet. Activity from orders, suppliers, and system events will appear here.</Text>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export const NotificationsScreen: React.FC<Props> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const slideY  = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, ...Theme.animation.spring, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getNotifications();
      setNotifications(data);
    } catch {
      // Graceful fallback — show empty state
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    ApiService.markNotificationRead(id).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    try {
      await ApiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const groups = groupNotifications(notifications);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY: slideY }] }]}>
      {/* Glassmorphic Header */}
      <BlurView intensity={60} tint="dark" style={styles.header}>
        <LinearGradient
          colors={['rgba(0,230,118,0.06)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <ChevronLeft size={22} color={Theme.colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>{unreadCount} unread</Text>
            )}
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
            <CheckCheck size={16} color={Theme.colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </BlurView>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(group => (
            <View key={group.label}>
              <View style={styles.groupLabelRow}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                <View style={styles.groupLine} />
              </View>
              {group.items.map((notif, idx) => (
                <NotifCard
                  key={notif.id}
                  notif={notif}
                  index={idx}
                  onDismiss={() => handleDismiss(notif.id)}
                />
              ))}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    overflow: 'hidden',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12, color: Theme.colors.primary, fontWeight: '600',
    letterSpacing: 0.3, marginTop: 1,
  },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Theme.borderRadius.pill,
    borderWidth: 1, borderColor: Theme.colors.borderGlow,
    backgroundColor: Theme.colors.primaryDeep,
  },
  markAllText: { fontSize: 12, color: Theme.colors.primary, fontWeight: '600' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Theme.colors.textMuted, fontSize: 14 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.md },

  groupLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 10, marginTop: 4,
  },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: Theme.colors.textMuted,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  groupLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1, borderColor: Theme.colors.border,
    padding: 14, marginBottom: 8, gap: 12,
  },
  notifCardUnread: {
    borderColor: 'rgba(0,230,118,0.18)',
    backgroundColor: 'rgba(0,230,118,0.03)',
  },
  notifIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  notifTitle: {
    flex: 1, fontSize: 14, fontWeight: '600', color: Theme.colors.textSecondary,
  },
  notifTitleUnread: { color: Theme.colors.text },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5 },
  notifBody: { fontSize: 13, color: Theme.colors.textMuted, lineHeight: 18, marginBottom: 5 },
  notifTime: { fontSize: 11, color: Theme.colors.textDim, fontWeight: '500', letterSpacing: 0.3 },
  dismissBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', flexShrink: 0,
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Theme.colors.primaryDeep,
    borderWidth: 1, borderColor: Theme.colors.borderGlow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Theme.colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: Theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
