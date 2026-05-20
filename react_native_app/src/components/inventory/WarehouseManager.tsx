import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil, Trash2, Plus, Check, X, Building2 } from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Props {
  warehouses: any[];
  onRefresh: () => void;
}

export const WarehouseManager: React.FC<Props> = ({ warehouses, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add form state
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const startEdit = (wh: any) => {
    setEditingId(wh.id);
    setEditName(wh.name || '');
    setEditLocation(wh.location || '');
  };

  const cancelEdit = () => setEditingId(null);

  const handleAddWarehouse = async () => {
    if (!name || !location) {
      Alert.alert('Incomplete', 'Please fill in both name and location.');
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.addWarehouse({ name, location });
      setName('');
      setLocation('');
      setShowAddForm(false);
      onRefresh();
      Alert.alert('✅ Warehouse Created', 'New warehouse added successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (whId: number | string) => {
    if (!editName || !editLocation) {
      Alert.alert('Incomplete', 'Name and Location cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.updateWarehouse(whId, {
        name: editName,
        location: editLocation,
      });
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (wh: any) => {
    Alert.alert(
      'Delete Warehouse',
      `Delete "${wh.name}"? Any products assigned here will lose their warehouse reference.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await ApiService.deleteWarehouse(wh.id);
              if (res.status === 'error') {
                Alert.alert('Failed', res.message);
              } else {
                onRefresh();
              }
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Summary stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(0,230,118,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.summaryLabel}>TOTAL WAREHOUSES</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.primary }]}>{warehouses.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <LinearGradient colors={['rgba(255,184,0,0.06)', 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={styles.summaryLabel}>PRIMARY HUB</Text>
          <Text style={[styles.summaryValue, { color: Theme.colors.secondary, fontSize: 13, marginTop: 6 }]} numberOfLines={1}>
            {warehouses[0]?.name || 'None'}
          </Text>
        </View>
      </View>

      {/* Add warehouse toggle */}
      <TouchableOpacity style={styles.addToggleBtn} onPress={() => setShowAddForm(!showAddForm)}>
        <LinearGradient
          colors={showAddForm ? ['rgba(255,42,85,0.15)', 'rgba(255,42,85,0.05)'] : Theme.gradients.primary}
          style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
        <Plus size={18} color={showAddForm ? Theme.colors.error : '#000'} />
        <Text style={[styles.addToggleText, { color: showAddForm ? Theme.colors.error : '#000' }]}>
          {showAddForm ? 'Cancel' : 'Register New Warehouse'}
        </Text>
      </TouchableOpacity>

      {/* Register Warehouse Form */}
      {showAddForm && (
        <View style={styles.formCard}>
          <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.formTitle}>🏢 New Warehouse</Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>WAREHOUSE NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Clifton Distribution Center"
              placeholderTextColor={Theme.colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>LOCATION / CITY *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Karachi, South"
              placeholderTextColor={Theme.colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleAddWarehouse} disabled={isSubmitting}>
            <LinearGradient colors={Theme.gradients.secondary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            {isSubmitting
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={styles.submitText}>Add Warehouse</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Warehouse list */}
      <Text style={styles.listTitle}>Warehouse Network ({warehouses.length})</Text>
      {warehouses.length === 0 && (
        <View style={styles.emptyState}>
          <Building2 size={40} color={Theme.colors.textMuted} />
          <Text style={styles.emptyText}>No warehouses found. Register one above.</Text>
        </View>
      )}

      {warehouses.map((wh) => {
        const isEditing = editingId === wh.id;
        return (
          <View key={wh.id} style={styles.whCard}>
            <LinearGradient colors={['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']} style={StyleSheet.absoluteFill} />
            
            {isEditing ? (
              <View style={styles.editForm}>
                <TextInput
                  style={[styles.input, styles.editInput]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Warehouse Name"
                  placeholderTextColor={Theme.colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.editInput]}
                  value={editLocation}
                  onChangeText={setEditLocation}
                  placeholder="Location"
                  placeholderTextColor={Theme.colors.textMuted}
                />
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.actionCircleBtn} onPress={() => handleSaveEdit(wh.id)}>
                    <Check size={16} color={Theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCircleBtn} onPress={cancelEdit}>
                    <X size={16} color={Theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.whDetails}>
                <View style={styles.whIconContainer}>
                  <Building2 size={20} color={Theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.whName}>{wh.name}</Text>
                  <Text style={styles.whLocation}>📍 {wh.location}</Text>
                  <Text style={styles.whId}>ID: #{wh.id}</Text>
                </View>
                <View style={styles.rowActions}>
                  <TouchableOpacity style={styles.rowBtn} onPress={() => startEdit(wh)}>
                    <Pencil size={15} color={Theme.colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rowBtn} onPress={() => handleDelete(wh)}>
                    <Trash2 size={15} color={Theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: Theme.spacing.xl },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: Theme.spacing.md },
  summaryCard: { flex: 1, borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.sm, overflow: 'hidden', alignItems: 'center' },
  summaryLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '900' },

  addToggleBtn: { height: 48, borderRadius: Theme.borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: Theme.spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  addToggleText: { fontSize: 14, fontWeight: '800' },

  formCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  formTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md },
  inputWrap: { marginBottom: Theme.spacing.sm },
  inputLabel: { color: Theme.colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  input: { height: 46, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: '#FFF', fontSize: 14 },
  submitBtn: { height: 48, borderRadius: Theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: Theme.spacing.md },
  submitText: { color: '#000', fontSize: 14, fontWeight: '900' },

  listTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md, letterSpacing: -0.3 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center' },

  whCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm, overflow: 'hidden', ...Theme.shadows.glass },
  whDetails: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whIconContainer: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(0,230,118,0.06)', borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)', alignItems: 'center', justifyContent: 'center' },
  whName: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  whLocation: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  whId: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: 4 },

  rowActions: { flexDirection: 'row', gap: 6 },
  rowBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  editForm: { gap: Theme.spacing.sm },
  editInput: { height: 40, fontSize: 13 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  actionCircleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' }
});
