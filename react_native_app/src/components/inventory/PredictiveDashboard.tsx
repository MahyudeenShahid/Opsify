import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Theme } from '../../core/theme';
import { ProcurementApproval } from './ProcurementApproval';

interface Props {
  predictions: any[];
  suggestions: any[];
  products?: any[];
  warehouses?: any[];
  onProcurementApproved?: () => void;
}

export const PredictiveDashboard: React.FC<Props> = ({
  predictions, suggestions, products = [], warehouses = [], onProcurementApproved
}) => {
  return (
    <View style={styles.container}>
      {/* Procurement Approval Panel — appears when stock is low */}
      <ProcurementApproval
        suggestions={suggestions}
        products={products}
        warehouses={warehouses}
        onProcurementApproved={onProcurementApproved || (() => {})}
      />

      <Text style={styles.sectionTitle}>🔮 Predictive Insights</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {predictions.map((pred) => (
          <View key={pred.product_id} style={styles.predictiveCard}>
            <Text style={styles.predictiveTitle}>{pred.name}</Text>
            <Text style={styles.predictiveData}>Daily Velocity: {pred.daily_velocity} {pred.unit}/day</Text>
            <Text style={styles.predictiveData}>Est. Stock Out:</Text>
            <Text style={styles.predictiveHighlight}>{pred.estimated_stockout_date}</Text>
          </View>
        ))}
      </ScrollView>
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
  horizontalScroll: {
    marginBottom: Theme.spacing.md,
  },
  predictiveCard: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.primary,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginRight: Theme.spacing.md,
    width: 220,
  },
  predictiveTitle: {
    color: Theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: Theme.spacing.xs,
  },
  predictiveData: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 2,
  },
  predictiveHighlight: {
    color: Theme.colors.secondary,
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: Theme.spacing.xs,
  },
});
