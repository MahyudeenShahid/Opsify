import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Props {
  inventory: any[];
  onRefresh: () => void;
}

export const ProductManager: React.FC<Props> = ({ inventory, onRefresh }) => {
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

  const handleAddProduct = async () => {
    if (!sku || !name || !stock || !threshold || !costPrice || !sellPrice) {
      Alert.alert('Error', 'Please fill the required product fields.');
      return;
    }

    try {
      await ApiService.addProduct({
        sku,
        name,
        category,
        variant,
        unit,
        stock: parseFloat(stock),
        reorder_threshold: parseFloat(threshold),
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(sellPrice),
        supplier_id: supplierId ? parseInt(supplierId) : null,
      });
      setSku(''); setName(''); setCategory(''); setVariant(''); setUnit('');
      setStock(''); setThreshold(''); setCostPrice(''); setSellPrice(''); setSupplierId('');
      onRefresh();
      Alert.alert('Success', 'Product added successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📦 Product Catalog</Text>
      {inventory.map((item) => {
        const isLowStock = item.stock <= item.reorder_threshold;
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.itemName}>{item.name} ({item.variant})</Text>
              <View style={[styles.badge, isLowStock ? styles.lowStockBadge : styles.okStockBadge]}>
                <Text style={[styles.badgeText, isLowStock ? styles.lowStockText : styles.okStockText]}>
                  {item.stock} {item.unit}
                </Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              ID: {item.id} | SKU: {item.sku} | Supplier: {item.supplier_name || 'None'}
            </Text>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>➕ Add New Product</Text>
      <View style={styles.formCard}>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="SKU" placeholderTextColor={Theme.colors.textMuted} value={sku} onChangeText={setSku} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Name" placeholderTextColor={Theme.colors.textMuted} value={name} onChangeText={setName} />
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Category" placeholderTextColor={Theme.colors.textMuted} value={category} onChangeText={setCategory} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Variant" placeholderTextColor={Theme.colors.textMuted} value={variant} onChangeText={setVariant} />
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Unit (e.g. Kg)" placeholderTextColor={Theme.colors.textMuted} value={unit} onChangeText={setUnit} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Supplier ID" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={supplierId} onChangeText={setSupplierId} />
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Initial Stock" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={stock} onChangeText={setStock} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Reorder Threshold" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={threshold} onChangeText={setThreshold} />
        </View>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Cost Price" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={costPrice} onChangeText={setCostPrice} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Selling Price" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} />
        </View>
        <TouchableOpacity style={styles.actionButton} onPress={handleAddProduct}>
          <Text style={styles.actionButtonText}>Create Product</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: Theme.spacing.md,
  },
  sectionTitle: {
    color: Theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: Theme.spacing.md,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: Theme.colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
  },
  lowStockBadge: {
    backgroundColor: 'rgba(255, 83, 118, 0.1)',
    borderColor: Theme.colors.error,
  },
  okStockBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: Theme.colors.secondary,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  lowStockText: {
    color: Theme.colors.error,
  },
  okStockText: {
    color: Theme.colors.secondary,
  },
  cardSubtitle: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    marginTop: Theme.spacing.xs,
  },
  formCard: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.md,
  },
  input: {
    height: 45,
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 0.48,
  },
  actionButton: {
    height: 45,
    backgroundColor: Theme.colors.secondary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
  },
  actionButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
