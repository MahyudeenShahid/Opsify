import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, ScrollView, View } from 'react-native';
import { Theme } from '../core/theme';

interface TraceTerminalProps {
  logs: string[];
}

export const TraceTerminal: React.FC<TraceTerminalProps> = ({ logs }) => {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [logs]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.terminalBg,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: Theme.colors.terminalBorder,
    padding: Theme.spacing.sm,
  },
  contentContainer: {
    paddingBottom: Theme.spacing.sm,
  },
  logText: {
    color: Theme.colors.secondary,
    fontFamily: 'monospace',
    fontSize: 12,
    marginVertical: 2,
  },
});
