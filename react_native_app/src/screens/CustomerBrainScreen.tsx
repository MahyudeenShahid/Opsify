import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Theme } from '../core/theme';
import { ApiService } from '../services/api';
import { TraceTerminal } from '../widgets/TraceTerminal';

export const CustomerBrainScreen: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  const handleSend = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    setTraceLogs([]);
    setStatus('Running Antigravity Graph...');
    setSelectedProvider(null);

    try {
      const data = await ApiService.sendOrder(message);
      setStatus(data.execution_status);
      setTraceLogs(data.trace_logs);
      setSelectedProvider(data.provider);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Opsify: Customer Brain</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Customer Request (Urdu/English)"
          placeholderTextColor={Theme.colors.textMuted}
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={isLoading}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />}

      {status ? <Text style={styles.statusText}>Status: {status}</Text> : null}

      {selectedProvider && Object.keys(selectedProvider).length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ Booked: {selectedProvider.name}</Text>
          <Text style={styles.cardSubtitle}>
            Rating: {selectedProvider.rating} ★ | Rs {selectedProvider.price_per_hr}/hr
          </Text>
          <Text style={styles.cardReasoning}>
            AI Reasoning: {selectedProvider.reasoning_string}
          </Text>
        </View>
      ) : null}

      <Text style={styles.terminalLabel}>Antigravity Agent Trace Logs:</Text>
      <View style={styles.terminalContainer}>
        <TraceTerminal logs={traceLogs} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: Theme.spacing.md,
  },
  title: {
    color: Theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.md,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    color: Theme.colors.text,
  },
  sendButton: {
    width: 80,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.sm,
  },
  sendButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  loader: {
    marginVertical: Theme.spacing.md,
  },
  statusText: {
    color: Theme.colors.text,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: Theme.spacing.sm,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  cardTitle: {
    color: Theme.colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: Theme.spacing.xs,
  },
  cardSubtitle: {
    color: Theme.colors.text,
    fontSize: 14,
    marginBottom: Theme.spacing.sm,
  },
  cardReasoning: {
    color: Theme.colors.textMuted,
    fontStyle: 'italic',
    fontSize: 13,
  },
  terminalLabel: {
    color: Theme.colors.text,
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: Theme.spacing.sm,
  },
  terminalContainer: {
    flex: 1,
  },
});
