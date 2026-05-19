import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] Caught:', error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AlertTriangle size={48} color="#FF6B6B" />
          <Text style={styles.title}>{this.props.fallbackTitle || 'Something went wrong'}</Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#8B949E',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#00F0FF',
  },
  buttonText: {
    color: '#00F0FF',
    fontWeight: '800',
    fontSize: 14,
  },
});
