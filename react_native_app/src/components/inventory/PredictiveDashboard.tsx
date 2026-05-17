import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Theme } from '../../core/theme';

interface Props {
  predictions: any[];
  suggestions: any[];
}

export const PredictiveDashboard: React.FC<Props> = ({ predictions, suggestions }) => {
  return (
    <View style={styles.container}>
      {/* Smart Reorder Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertHeader}>⚠️ AI Reorder Suggestions</Text>
          {suggestions.map((sug, idx) => (
            <View key={idx} style={styles.alertCard}>
              <Text style={[styles.alertMessage, sug.urgency === 'High' ? styles.alertHigh : styles.alertMedium]}>
                {sug.message}
              </Text>
            </View>
          ))}
        </View>
      )}

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
  alertContainer: {
    backgroundColor: 'rgba(255, 83, 118, 0.1)',
    borderColor: Theme.colors.error,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  alertHeader: {
    color: Theme.colors.error,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: Theme.spacing.sm,
  },
  alertCard: {
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertHigh: {
    color: Theme.colors.error,
  },
  alertMedium: {
    color: '#FFB86C',
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
