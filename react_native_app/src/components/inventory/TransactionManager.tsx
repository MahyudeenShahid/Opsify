import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

interface Props {
  ledger: any[];
  onRefresh: () => void;
}

export const TransactionManager: React.FC<Props> = ({ ledger, onRefresh }) => {
  const [saleProdId, setSaleProdId] = useState('');
  const [saleQty, setSaleQty] = useState('');
  const [saleVal, setSaleVal] = useState('');

  const [restockProdId, setRestockProdId] = useState('');
  const [restockQty, setRestockQty] = useState('');
  const [restockVal, setRestockVal] = useState('');

  const [adjProdId, setAdjProdId] = useState('');
  const [adjQtyDiff, setAdjQtyDiff] = useState('');
  const [adjReason, setAdjReason] = useState('');

  const handleTx = async (type: 'sale' | 'restock' | 'adjustment', data: any, clearForm: () => void) => {
    try {
      await ApiService.recordTransaction(type, data);
      clearForm();
      onRefresh();
      Alert.alert('Success', `${type.toUpperCase()} recorded.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>💸 Record Sale</Text>
      <View style={styles.formCard}>
        <TextInput style={styles.input} placeholder="Product ID" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={saleProdId} onChangeText={setSaleProdId} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Qty Sold" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={saleQty} onChangeText={setSaleQty} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Revenue (Rs)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={saleVal} onChangeText={setSaleVal} />
        </View>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleTx('sale', { product_id: parseInt(saleProdId), quantity: parseFloat(saleQty), value: parseFloat(saleVal) }, () => { setSaleProdId(''); setSaleQty(''); setSaleVal(''); })}>
          <Text style={styles.actionButtonText}>Commit Sale</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>📦 Restock Inventory (Purchase)</Text>
      <View style={styles.formCard}>
        <TextInput style={styles.input} placeholder="Product ID" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={restockProdId} onChangeText={setRestockProdId} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Qty Received" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={restockQty} onChangeText={setRestockQty} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Cost Paid (Rs)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={restockVal} onChangeText={setRestockVal} />
        </View>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Theme.colors.primary }]} onPress={() => handleTx('restock', { product_id: parseInt(restockProdId), quantity: parseFloat(restockQty), value: parseFloat(restockVal) }, () => { setRestockProdId(''); setRestockQty(''); setRestockVal(''); })}>
          <Text style={styles.actionButtonText}>Record Restock</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>⚖️ Audit Adjustments</Text>
      <View style={styles.formCard}>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Product ID" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={adjProdId} onChangeText={setAdjProdId} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Qty Diff (e.g. -2)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={adjQtyDiff} onChangeText={setAdjQtyDiff} />
        </View>
        <TextInput style={styles.input} placeholder="Audit Reason (Damage, Expiry)" placeholderTextColor={Theme.colors.textMuted} value={adjReason} onChangeText={setAdjReason} />
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: Theme.colors.error }]} onPress={() => handleTx('adjustment', { product_id: parseInt(adjProdId), quantity_diff: parseFloat(adjQtyDiff), reason: adjReason }, () => { setAdjProdId(''); setAdjQtyDiff(''); setAdjReason(''); })}>
          <Text style={styles.actionButtonText}>Log Audit Adjustment</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>📊 Audit Ledger</Text>
      {ledger.map((tx) => (
        <View key={tx.id} style={styles.ledgerCard}>
          <View style={styles.ledgerHeader}>
            <Text style={styles.ledgerTitle}>
              {tx.type}: {tx.quantity} {tx.unit} x {tx.product_name}
            </Text>
            <Text style={styles.ledgerValue}>
              {tx.type === 'ADJUSTMENT' ? `Audit: ${tx.reason}` : `Rs ${tx.total_value}`}
            </Text>
          </View>
          <Text style={styles.ledgerTime}>Timestamp: {tx.timestamp}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: Theme.spacing.md },
  sectionTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: 'bold', marginVertical: Theme.spacing.md },
  formCard: { backgroundColor: Theme.colors.surface, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.xl, padding: Theme.spacing.md },
  input: { height: 45, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: Theme.colors.text, marginBottom: Theme.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { flex: 0.48 },
  actionButton: { height: 45, backgroundColor: Theme.colors.secondary, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: Theme.spacing.xs },
  actionButtonText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  ledgerCard: { backgroundColor: '#161926', borderRadius: Theme.borderRadius.md, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm },
  ledgerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.xs },
  ledgerTitle: { color: Theme.colors.text, fontWeight: 'bold', fontSize: 15 },
  ledgerValue: { color: Theme.colors.primary, fontWeight: 'bold' },
  ledgerTime: { color: Theme.colors.textMuted, fontSize: 11 },
});
