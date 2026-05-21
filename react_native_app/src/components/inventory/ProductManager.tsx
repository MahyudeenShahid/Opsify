import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil, Trash2, Plus, Check, X, Package } from 'lucide-react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Props {
  inventory: any[];
  onRefresh: () => void;
}

const STOCK_BAR_MAX = 200;

export const ProductManager: React.FC<Props> = ({ inventory, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [variant, setVariant] = useState('');
  const [unit, setUnit] = useState('');
  const [stock, setStock] = useState('');
  const [threshold, setThreshold] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVariant, setEditVariant] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editThreshold, setEditThreshold] = useState('');
  const [editStock, setEditStock] = useState('');

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name || '');
    setEditCategory(item.category || '');
    setEditVariant(item.variant || '');
    setEditUnit(item.unit || '');
    setEditCostPrice(String(item.cost_price || ''));
    setEditSellPrice(String(item.selling_price || ''));
    setEditThreshold(String(item.reorder_threshold || ''));
    setEditStock(String(item.stock || ''));
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (item: any) => {
    setIsSubmitting(true);
    try {
      await ApiService.updateProduct(item.id, {
        name: editName || undefined,
        category: editCategory || undefined,
        variant: editVariant || undefined,
        unit: editUnit || undefined,
        cost_price: editCostPrice ? parseFloat(editCostPrice) : undefined,
        selling_price: editSellPrice ? parseFloat(editSellPrice) : undefined,
        reorder_threshold: editThreshold ? parseFloat(editThreshold) : undefined,
        stock: editStock ? parseFloat(editStock) : undefined,
        warehouse_id: item.warehouse_id || 1,
      });
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: any) => {
    const msg = `Delete "${item.name}"? This will also remove all its stock and transaction history.`;

    Alert.alert(
      'Delete Product',
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteProduct(item.id);
              onRefresh();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const handleAddProduct = async () => {
    if (!sku || !name || !stock || !threshold || !costPrice || !sellPrice) {
      Alert.alert('Error', 'Fill in SKU, Name, Stock, Threshold, Cost Price, and Selling Price.');
      return;
    }
    setIsSubmitting(true);
    try {
      await ApiService.addProduct({
        sku, name, category, variant, unit,
        stock: parseFloat(stock),
        reorder_threshold: parseFloat(threshold),
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(sellPrice),
        supplier_id: supplierId ? parseInt(supplierId) : null,
      });
      setSku(''); setName(''); setCategory(''); setVariant(''); setUnit('');
      setStock(''); setThreshold(''); setCostPrice(''); setSellPrice(''); setSupplierId('');
      setShowAddForm(false);
      onRefresh();
      Alert.alert('✅ Product Added', 'New product created successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deduplicate by id (in case of multiple warehouse rows)
  const seen = new Set<number>();
  const uniqueInventory = inventory.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header & Toggle */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>Product Catalog</Text>
          <Text style={styles.sectionSub}>{uniqueInventory.length} items in inventory</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, showAddForm && styles.addBtnCancel]} onPress={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <X size={16} color={Theme.colors.error} /> : <Plus size={16} color={Theme.colors.primary} />}
          <Text style={[styles.addBtnText, showAddForm && { color: Theme.colors.error }]}>
            {showAddForm ? 'Cancel' : 'Add Product'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Form */}
      {showAddForm && (
        <View style={styles.formCard}>
          <LinearGradient pointerEvents="none" colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.formTitle}>📦 New Product</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.half]} placeholder="SKU *" placeholderTextColor={Theme.colors.textMuted} value={sku} onChangeText={setSku} />
            <TextInput style={[styles.input, styles.half]} placeholder="Name *" placeholderTextColor={Theme.colors.textMuted} value={name} onChangeText={setName} />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.half]} placeholder="Category" placeholderTextColor={Theme.colors.textMuted} value={category} onChangeText={setCategory} />
            <TextInput style={[styles.input, styles.half]} placeholder="Variant" placeholderTextColor={Theme.colors.textMuted} value={variant} onChangeText={setVariant} />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.half]} placeholder="Unit (e.g. Kg)" placeholderTextColor={Theme.colors.textMuted} value={unit} onChangeText={setUnit} />
            <TextInput style={[styles.input, styles.half]} placeholder="Supplier ID" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={supplierId} onChangeText={setSupplierId} />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.half]} placeholder="Initial Stock *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={stock} onChangeText={setStock} />
            <TextInput style={[styles.input, styles.half]} placeholder="Reorder Threshold *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={threshold} onChangeText={setThreshold} />
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.half]} placeholder="Cost Price *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={costPrice} onChangeText={setCostPrice} />
            <TextInput style={[styles.input, styles.half]} placeholder="Selling Price *" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} />
          </View>
          <TouchableOpacity style={[styles.createBtn, isSubmitting && { opacity: 0.6 }]} onPress={handleAddProduct} disabled={isSubmitting}>
            <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.createBtnText}>Create Product</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Product List */}
      {uniqueInventory.length === 0 && (
        <View style={styles.emptyState}>
          <Package size={40} color={Theme.colors.textMuted} />
          <Text style={styles.emptyText}>No products yet. Add your first product above.</Text>
        </View>
      )}

      {uniqueInventory.map((item) => {
        const isLowStock = item.stock <= item.reorder_threshold;
        const isCritical = item.stock === 0;
        const stockColor = isCritical ? Theme.colors.error : isLowStock ? Theme.colors.warning : Theme.colors.primary;
        const barPct = Math.min((item.stock / STOCK_BAR_MAX) * 100, 100);
        const margin = item.selling_price > 0 ? ((item.selling_price - item.cost_price) / item.selling_price * 100) : 0;
        const isEditing = editingId === item.id;

        return (
          <View key={item.id} style={[styles.productCard, isLowStock && { borderColor: `${stockColor}50` }]}>
            <LinearGradient
              colors={isLowStock ? [`${stockColor}08`, 'rgba(17,22,34,0.95)'] : ['rgba(26,34,52,0.9)', 'rgba(17,22,34,0.9)']}
              style={StyleSheet.absoluteFill}
            />

            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>SKU: {item.sku} · {item.variant || item.unit} · {item.supplier_name || 'No Supplier'}</Text>
              </View>
              <View style={styles.headerActions}>
                {!isEditing && (
                  <>
                    <TouchableOpacity onPress={() => startEdit(item)} style={styles.iconBtn}>
                      <Pencil size={14} color={Theme.colors.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                      <Trash2 size={14} color={Theme.colors.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Stock Health Bar */}
            {!isEditing && (
              <>
                <View style={styles.stockRow}>
                  <View style={[styles.stockBadge, { backgroundColor: `${stockColor}15`, borderColor: `${stockColor}50` }]}>
                    <Text style={[styles.stockText, { color: stockColor }]}>
                      {isCritical ? '🚨 OUT OF STOCK' : isLowStock ? '⚠️ LOW STOCK' : '✅ IN STOCK'} · {item.stock} {item.unit}
                    </Text>
                  </View>
                  <Text style={styles.threshold}>Min: {item.reorder_threshold}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barPct}%`, backgroundColor: stockColor }]} />
                </View>
                <View style={styles.priceRow}>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>COST</Text>
                    <Text style={styles.priceValue}>Rs {item.cost_price}</Text>
                  </View>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>PRICE</Text>
                    <Text style={[styles.priceValue, { color: Theme.colors.secondary }]}>Rs {item.selling_price}</Text>
                  </View>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>MARGIN</Text>
                    <Text style={[styles.priceValue, { color: margin >= 20 ? Theme.colors.primary : Theme.colors.warning }]}>
                      {margin.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>WAREHOUSE</Text>
                    <Text style={styles.priceValue}>{item.warehouse_name || `WH #${item.warehouse_id}`}</Text>
                  </View>
                </View>
              </>
            )}

            {/* Inline Edit Form */}
            {isEditing && (
              <View style={styles.editForm}>
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.half]} placeholder="Name" placeholderTextColor={Theme.colors.textMuted} value={editName} onChangeText={setEditName} />
                  <TextInput style={[styles.input, styles.half]} placeholder="Variant" placeholderTextColor={Theme.colors.textMuted} value={editVariant} onChangeText={setEditVariant} />
                </View>
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.half]} placeholder="Category" placeholderTextColor={Theme.colors.textMuted} value={editCategory} onChangeText={setEditCategory} />
                  <TextInput style={[styles.input, styles.half]} placeholder="Unit" placeholderTextColor={Theme.colors.textMuted} value={editUnit} onChangeText={setEditUnit} />
                </View>
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.half]} placeholder="Cost Price" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={editCostPrice} onChangeText={setEditCostPrice} />
                  <TextInput style={[styles.input, styles.half]} placeholder="Selling Price" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={editSellPrice} onChangeText={setEditSellPrice} />
                </View>
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.half]} placeholder="Stock" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={editStock} onChangeText={setEditStock} />
                  <TextInput style={[styles.input, styles.half]} placeholder="Reorder Threshold" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={editThreshold} onChangeText={setEditThreshold} />
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveEdit(item)} disabled={isSubmitting}>
                    <LinearGradient colors={Theme.gradients.primary} style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.sm }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                    {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <><Check size={14} color="#000" /><Text style={styles.saveBtnText}>Save</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                    <X size={14} color={Theme.colors.error} />
                    <Text style={styles.cancelBtnText}>Cancel</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
  sectionTitle: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  sectionSub: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: Theme.borderRadius.pill, backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 1, borderColor: Theme.colors.primary },
  addBtnCancel: { backgroundColor: 'rgba(255,42,85,0.1)', borderColor: Theme.colors.error },
  addBtnText: { color: Theme.colors.primary, fontSize: 13, fontWeight: '800' },

  formCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.lg, overflow: 'hidden' },
  formTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: Theme.spacing.md },
  row: { flexDirection: 'row', gap: 8 },
  input: { height: 44, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: '#FFF', fontSize: 14, marginBottom: Theme.spacing.sm },
  half: { flex: 1 },
  createBtn: { height: 46, borderRadius: Theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 4 },
  createBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 14, textAlign: 'center', maxWidth: 240 },

  productCard: { borderRadius: Theme.borderRadius.lg, borderWidth: 1.5, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden', ...Theme.shadows.glass },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Theme.spacing.sm },
  itemName: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  itemMeta: { color: Theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },

  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  stockText: { fontSize: 11, fontWeight: '800' },
  threshold: { color: Theme.colors.textMuted, fontSize: 11 },
  barTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: Theme.spacing.sm, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceItem: {},
  priceLabel: { color: Theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  priceValue: { color: '#FFF', fontSize: 13, fontWeight: '800', marginTop: 2 },

  editForm: { marginTop: 8 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  saveBtn: { flex: 1, height: 38, borderRadius: Theme.borderRadius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden' },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  cancelBtn: { flex: 1, height: 38, borderRadius: Theme.borderRadius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,42,85,0.1)', borderWidth: 1, borderColor: Theme.colors.error },
  cancelBtnText: { color: Theme.colors.error, fontWeight: '800', fontSize: 13 },
});
