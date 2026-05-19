import React, { useState } from 'react';
import { View, StyleSheet, Alert, TextInput, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { ChatListScreen } from './ChatListScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { Chat, User, FirebaseChatService } from '../../services/firebaseChatService';
import { Theme } from '../../core/theme';

type Screen = 'list' | 'room' | 'new-chat';

export const OmniChatScreen = ({ currentUserId }: { currentUserId: string }) => {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedChat, setSelectedChat] = useState<{ chat: Chat; otherUser: User } | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  if (!currentUserId) return null;

  // ── New Chat: email search ────────────────────────────────────────────────
  if (screen === 'new-chat') {
    const handleSearch = async () => {
      if (!searchEmail.trim()) return;
      setIsSearching(true);
      try {
        const users = await FirebaseChatService.searchUsersByEmail(searchEmail.trim());
        if (users.length === 0) {
          Alert.alert('Not Found', 'No user registered with that email address.');
          setIsSearching(false);
          return;
        }
        const target = users[0];
        const chatId = await FirebaseChatService.createOrGetChat(currentUserId, target.uid);
        const chat: Chat = {
          id: chatId,
          participants: [currentUserId, target.uid],
          lastMessage: '',
          lastMessageTimestamp: null,
          updatedAt: null,
          users: [target],
        };
        setSelectedChat({ chat, otherUser: target });
        setSearchEmail('');
        setScreen('room');
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setIsSearching(false);
      }
    };

    return (
      <View style={styles.newChatContainer}>
        <Text style={styles.newChatTitle}>Start New Conversation</Text>
        <Text style={styles.newChatSubtitle}>Enter the contact's email address to find them.</Text>
        <TextInput
          style={styles.newChatInput}
          placeholder="name@company.com"
          placeholderTextColor={Theme.colors.textMuted}
          value={searchEmail}
          onChangeText={setSearchEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />
        <TouchableOpacity style={styles.newChatBtn} onPress={handleSearch} disabled={isSearching}>
          {isSearching
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.newChatBtnText}>Search & Connect</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setScreen('list')}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Chat Room ──────────────────────────────────────────────────────────────
  if (screen === 'room' && selectedChat) {
    return (
      <ChatRoomScreen
        chatId={selectedChat.chat.id}
        currentUserId={currentUserId}
        otherUser={selectedChat.otherUser}
        onBack={() => { setSelectedChat(null); setScreen('list'); }}
      />
    );
  }

  // ── Chat List ──────────────────────────────────────────────────────────────
  return (
    <ChatListScreen
      currentUserId={currentUserId}
      onSelectChat={(chat, otherUser) => {
        setSelectedChat({ chat, otherUser });
        setScreen('room');
      }}
      onNewChat={() => setScreen('new-chat')}
    />
  );
};

const styles = StyleSheet.create({
  newChatContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    padding: 32,
    paddingTop: 80,
  },
  newChatTitle: {
    color: Theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  newChatSubtitle: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    marginBottom: 32,
  },
  newChatInput: {
    height: 52,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: 16,
    color: Theme.colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  newChatBtn: {
    height: 52,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  newChatBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 15,
  },
  cancelBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
