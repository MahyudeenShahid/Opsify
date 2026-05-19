import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity, Package, ShoppingCart, TrendingUp, Users,
  Plus, Edit2, Trash2, RefreshCw, Filter, Zap, Navigation,
} from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

type FilterType = 'ALL' | 'ADD' | 'EDIT' | 'DELETE' | 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'ORDER' | 'DISPATCH';

const ACTION_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  ADD:        { icon: Plus,       color: Theme.colors.primary,   bg: 'rgba(0,230,118,0.1)',  label: 'Added' },
  EDIT:       { icon: Edit2,      color: '#00B0FF',              bg: 'rgba(0,176,255,0.1)',  label: 'Edited' },
  DELETE:     { icon: Trash2,     color: Theme.colors.error,     bg: 'rgba(255,42,85,0.1)', label: 'Deleted' },
  DELETE_ALL: { icon: Trash2,     color: Theme.colors.error,     bg: 'rgba(255,42,85,0.1)', label: 'Deleted All' },
  SALE:       { icon: TrendingUp, color: Theme.colors.secondary, bg: 'rgba(0,240,255,0.1)', label: 'Sale' },
  RESTOCK:    { icon: Package,    color: '#9B59B6',              bg: 'rgba(155,89,182,0.1)', label: 'Restock' },
  ADJUSTMENT: { icon: RefreshCw,  color: '#FFB800',              bg: 'rgba(255,184,0,0.1)', label: 'Adjustment' },
  ORDER:      { icon: ShoppingCart,color: '#FF9100',             bg: 'rgba(255,145,0,0.1)', label: 'Order' },
  ORDER_STATUS:{ icon: ShoppingCart,color: '#FF9100',            bg: 'rgba(255,145,0,0.08)',label: 'Order Update' },
  DISPATCH:   { icon: Navigation, color: Theme.colors.primary,   bg: 'rgba(0,230,118,0.08)', label: 'Dispatched' },
};

const ENTITY_ICONS: Record<string, any> = {
  product: Package, supplier: Users, order: ShoppingCart,
  transaction: TrendingUp, warehouse: Activity,
};

function relativeTime(isoStr: string): string {
  try {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7)   return `${days}d ago`;
    return new Date(isoStr).toLocaleDateString();
  } catch { return ''; }
}

const FILTER_TABS: { id: FilterType; label: string }[] = [
  { id: 'ALL',        label: 'All' },
  { id: 'ADD',        label: 'Added' },
  { id: 'EDIT',       label: 'Edited' },
  { id: 'DELETE',     label: 'Deleted' },
  { id: 'SALE',       label: 'Sales' },
  { id: 'RESTOCK',    label: 'Restocks' },
  { id: 'ORDER',      label: 'Orders' },
  { id: 'DISPATCH',   label: 'Dispatches' },
];

export const ActivityLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getActivityLog(200);
      setLogs(data);
    } catch (e) {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filter === 'ALL'
    ? logs
    : logs.filter(l => l.action === filter || (filter === 'ORDER' && (l.action === 'ORDER' || l.action === 'ORDER_STATUS')));

  return (
    <View style={styles.container}>
      {/* Filter Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.filterTab, filter === tab.id && styles.filterTabActive]}
            onPress={() => setFilter(tab.id)}
          >
            <Text style={[styles.filterTabText, filter === tab.id && styles.filterTabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count + Refresh */}
      <View style={styles.toolbar}>
        <Activity size={14} color={Theme.colors.primary} />
        <Text style={styles.toolbarText}>{filtered.length} activities</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchLogs} disabled={isLoading}>
          {isLoading ? <ActivityIndicator size="small" color={Theme.colors.primary} /> : <RefreshCw size={14} color={Theme.colors.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.logList}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchLogs} tintColor={Theme.colors.primary} />}
      >
        {isLoading && filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.emptyText}>Loading activity log...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Activity size={40} color={Theme.colors.textMuted} />
            <Text style={styles.emptyText}>No activities yet. Actions like adding products, recording sales, and managing orders will appear here.</Text>
          </View>
        ) : (
          filtered.map((log, i) => {
            const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.EDIT;
            const Icon = cfg.icon;
            const details = log.details || {};
            const name = details.name || details.product_name || details.customer || '';
            const qty  = details.qty != null ? ` · ${details.qty} units` : '';
            const val  = details.value != null ? ` · Rs ${details.value}` : '';
            const status = details.status ? ` → ${details.status}` : '';
            const courier = details.courier ? ` by ${details.courier}` : '';
            return (
              <View key={log.log_id || i} style={styles.logItem}>
                <View style={[styles.iconCircle, { backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }]}>
                  <Icon size={14} color={cfg.color} />
                </View>
                <View style={styles.logBody}>
                  <View style={styles.logTopRow}>
                    <View style={[styles.actionPill, { backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }]}>
                      <Text style={[styles.actionPillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.entityLabel}>{log.entity}</Text>
                    <Text style={styles.timeLabel}>{relativeTime(log.timestamp)}</Text>
                  </View>
                  <Text style={styles.logDetail} numberOfLines={2}>
                    {name}{qty}{val}{status}{courier}
                    {!name && !qty && !val ? JSON.stringify(details).slice(0, 80) : ''}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  filterScroll: { flexGrow: 0, marginBottom: 8 },
  filterContent: { paddingHorizontal: Theme.spacing.md, gap: 6, flexDirection: 'row', paddingVertical: 4 },
  filterTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border },
  filterTabActive: { backgroundColor: 'rgba(0,230,118,0.1)', borderColor: Theme.colors.primary },
  filterTabText: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
  filterTabTextActive: { color: Theme.colors.primary },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Theme.spacing.md, paddingBottom: 8 },
  toolbarText: { color: Theme.colors.textMuted, fontSize: 12, flex: 1 },
  refreshBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,230,118,0.08)', borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)', alignItems: 'center', justifyContent: 'center' },

  logList: { paddingHorizontal: Theme.spacing.md, paddingBottom: 40, gap: 0 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  logItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0, marginTop: 2 },

  logBody: { flex: 1 },
  logTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  actionPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100, borderWidth: 1 },
  actionPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  entityLabel: { color: Theme.colors.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  timeLabel: { color: Theme.colors.textMuted, fontSize: 10, marginLeft: 'auto' },
  logDetail: { color: Theme.colors.text, fontSize: 12, lineHeight: 18 },
});
