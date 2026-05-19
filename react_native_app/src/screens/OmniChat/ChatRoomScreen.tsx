import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Check, CheckCheck } from 'lucide-react-native';

import { Theme } from '../../core/theme';
import { FirebaseChatService, Message, User } from '../../services/firebaseChatService';

export const ChatRoomScreen = ({ chatId, currentUserId, otherUser, onBack }: { chatId: string, currentUserId: string, otherUser: User, onBack: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    FirebaseChatService.markMessagesAsRead(chatId, currentUserId);
    const unsubscribe = FirebaseChatService.subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      FirebaseChatService.markMessagesAsRead(chatId, currentUserId);
    });
    return () => unsubscribe();
  }, [chatId, currentUserId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText('');
    try {
      await FirebaseChatService.sendMessage(chatId, currentUserId, textToSend);
    } catch (e) {
      console.error('Failed to send message:', e);
      setInputText(textToSend);
    }
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isMe = item.senderId === currentUserId;
    const timeString = item.timestamp ? new Date(item.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...';

    return <AnimatedMessageBubble item={item} isMe={isMe} timeString={timeString} index={index} />;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Sticky Translucent Header */}
      <View style={styles.headerWrapper}>
        <BlurView intensity={60} tint="dark" style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <ChevronLeft color={Theme.colors.primary} size={28} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUser.name}</Text>
            <Text style={styles.headerPhone}>{otherUser.email}</Text>
          </View>
        </BlurView>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Footer */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={Theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]} 
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <LinearGradient colors={Theme.gradients.primary} style={styles.sendButtonGradient}>
            <Send color="#000" size={18} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const AnimatedMessageBubble = ({ item, isMe, timeString, index }: any) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
        <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMe ? { color: 'rgba(0,0,0,0.6)' } : { color: Theme.colors.textMuted }]}>{timeString}</Text>
          {isMe && (
            <View style={{ marginLeft: 4 }}>
              {item.status === 'read' || item.status === 'delivered' ? <CheckCheck size={12} color="rgba(0,0,0,0.6)" /> : <Check size={12} color="rgba(0,0,0,0.6)" />}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  headerWrapper: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, ...Theme.shadows.glass },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Theme.spacing.md, paddingTop: Platform.OS === 'ios' ? 50 : Theme.spacing.lg, paddingBottom: Theme.spacing.md, backgroundColor: 'rgba(21, 24, 40, 0.5)' },
  backButton: { marginRight: Theme.spacing.sm, padding: 4 },
  headerInfo: { flex: 1 },
  headerName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  headerPhone: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  messageList: { paddingHorizontal: Theme.spacing.md, paddingTop: 100, paddingBottom: 24 },
  messageRow: { flexDirection: 'row', marginBottom: Theme.spacing.sm },
  messageRowMe: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: Theme.spacing.md, borderRadius: Theme.borderRadius.lg },
  messageBubbleMe: { backgroundColor: Theme.colors.primary, borderBottomRightRadius: 4, ...Theme.shadows.glow },
  messageBubbleOther: { backgroundColor: Theme.colors.surfaceLight, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Theme.colors.border },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextMe: { color: '#000', fontWeight: '500' },
  messageTextOther: { color: '#FFF' },
  messageFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 },
  messageTime: { fontSize: 10 },
  inputContainer: { flexDirection: 'row', padding: Theme.spacing.md, backgroundColor: Theme.colors.surface, borderTopWidth: 1, borderTopColor: Theme.colors.border, alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 34 : Theme.spacing.md },
  input: { flex: 1, backgroundColor: Theme.colors.background, borderWidth: 1, borderColor: Theme.colors.border, borderRadius: 24, paddingHorizontal: Theme.spacing.md, paddingTop: 12, paddingBottom: 12, color: '#FFF', maxHeight: 100, fontSize: 15 },
  sendButton: { marginLeft: Theme.spacing.sm, borderRadius: 24, overflow: 'hidden' },
  sendButtonGradient: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }
});
