import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Theme } from '../../core/theme';
import { ApiService } from '../../services/api';

export const SupplierManager: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [rating, setRating] = useState('');
  const [reliability, setReliability] = useState('');
  const [leadTime, setLeadTime] = useState('');

  const fetchSuppliers = async () => {
    try {
      const data = await ApiService.getSuppliers();
      setSuppliers(data);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async () => {
    if (!name || !contact || !rating || !reliability || !leadTime) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      await ApiService.addSupplier({
        name,
        contact,
        rating: parseFloat(rating),
        reliability_score: parseFloat(reliability),
        lead_time_days: parseInt(leadTime),
      });
      setName(''); setContact(''); setRating(''); setReliability(''); setLeadTime('');
      fetchSuppliers();
      Alert.alert('Success', 'Supplier added successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🤝 Supplier Directory</Text>
      {suppliers.map((sup) => (
        <View key={sup.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.itemName}>{sup.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⭐ {sup.rating}</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>ID: {sup.id} | Contact: {sup.contact}</Text>
          <Text style={styles.cardSubtitle}>Reliability: {sup.reliability_score}% | Lead Time: {sup.lead_time_days} days</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>➕ Add New Supplier</Text>
      <View style={styles.formCard}>
        <TextInput style={styles.input} placeholder="Company Name" placeholderTextColor={Theme.colors.textMuted} value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Contact Email/Phone" placeholderTextColor={Theme.colors.textMuted} value={contact} onChangeText={setContact} />
        
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Rating (0.0-5.0)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={rating} onChangeText={setRating} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Reliability Score (%)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={reliability} onChangeText={setReliability} />
        </View>
        <TextInput style={styles.input} placeholder="Lead Time (Days)" placeholderTextColor={Theme.colors.textMuted} keyboardType="numeric" value={leadTime} onChangeText={setLeadTime} />
        
        <TouchableOpacity style={styles.actionButton} onPress={handleAddSupplier}>
          <Text style={styles.actionButtonText}>Create Supplier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingBottom: Theme.spacing.md },
  sectionTitle: { color: Theme.colors.text, fontSize: 18, fontWeight: 'bold', marginVertical: Theme.spacing.md },
  card: { backgroundColor: Theme.colors.surface, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.xl, padding: Theme.spacing.md, marginBottom: Theme.spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { color: Theme.colors.text, fontWeight: 'bold', fontSize: 16 },
  badge: { paddingHorizontal: Theme.spacing.sm, paddingVertical: Theme.spacing.xs, borderRadius: 12, borderWidth: 1, borderColor: '#FFB86C', backgroundColor: 'rgba(255, 184, 108, 0.1)' },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#FFB86C' },
  cardSubtitle: { color: Theme.colors.textMuted, fontSize: 13, marginTop: Theme.spacing.xs },
  formCard: { backgroundColor: Theme.colors.surface, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.xl, padding: Theme.spacing.md },
  input: { height: 45, backgroundColor: Theme.colors.background, borderColor: Theme.colors.border, borderWidth: 1.5, borderRadius: Theme.borderRadius.md, paddingHorizontal: Theme.spacing.md, color: Theme.colors.text, marginBottom: Theme.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { flex: 0.48 },
  actionButton: { height: 45, backgroundColor: Theme.colors.secondary, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: Theme.spacing.xs },
  actionButtonText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
