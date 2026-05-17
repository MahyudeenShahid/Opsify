import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';

export const InventoryDashboardScreen: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [prodId, setProdId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [revenue, setRevenue] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const inv = await ApiService.getProducts();
      const led = await ApiService.getTransactions();
      setInventory(inv);
      setLedger(led);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordSale = async () => {
    if (!prodId || !quantity || !revenue) {
      Alert.alert('Missing Fields', 'Please fill in all transaction fields.');
      return;
    }

    try {
      await ApiService.recordTransaction('sale', {
        product_id: parseInt(prodId),
        quantity: parseFloat(quantity),
        value: parseFloat(revenue),
      });
      setProdId('');
      setQuantity('');
      setRevenue('');
      fetchData();
      Alert.alert('Success', 'Sale logged successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record transaction');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Opsify: Inventory Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchData}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : (
        <>
          <Text style={styles.sectionTitle}>📦 Stock Inventory Levels</Text>
          {inventory.map((item) => {
            const isLowStock = item.stock <= item.reorder_threshold;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.itemName}>{item.name} ({item.sku})</Text>
                  <View style={[styles.badge, isLowStock ? styles.lowStockBadge : styles.okStockBadge]}>
                    <Text style={[styles.badgeText, isLowStock ? styles.lowStockText : styles.okStockText]}>
                      {item.stock} in stock
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  ID: {item.id} | Supplier: {item.supplier_name || 'None'}
                </Text>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>💸 Record Product Sales</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Product ID (e.g. 1)"
              placeholderTextColor={Theme.colors.textMuted}
              keyboardType="numeric"
              value={prodId}
              onChangeText={setProdId}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Qty Sold"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Revenue Earned (Rs)"
                placeholderTextColor={Theme.colors.textMuted}
                keyboardType="numeric"
                value={revenue}
                onChangeText={setRevenue}
              />
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleRecordSale}>
              <Text style={styles.actionButtonText}>Commit Sale Transaction</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>📊 Financial Ledger & Logs</Text>
          {ledger.map((tx) => (
            <View key={tx.id} style={styles.ledgerCard}>
              <View style={styles.ledgerHeader}>
                <Text style={styles.ledgerTitle}>
                  {tx.type}: {tx.quantity} x {tx.product_name}
                </Text>
                <Text style={styles.ledgerValue}>Rs {tx.total_value}</Text>
              </View>
              <Text style={styles.ledgerTime}>Timestamp: {tx.timestamp}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  contentContainer: {
    padding: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  title: {
    color: Theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
  },
  refreshButtonText: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: Theme.spacing.xl,
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
  ledgerCard: {
    backgroundColor: '#161926',
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  ledgerTitle: {
    color: Theme.colors.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  ledgerValue: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
  },
  ledgerTime: {
    color: Theme.colors.textMuted,
    fontSize: 11,
  },
});
