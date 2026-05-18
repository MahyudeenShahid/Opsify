import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { auth } from '../../config/firebaseConfig';
import { ChatListScreen } from './ChatListScreen';
import { ChatRoomScreen } from './ChatRoomScreen';
import { Chat, User } from '../../services/firebaseChatService';
import { Theme } from '../../core/theme';

export const OmniChatScreen = ({ currentUserId }: { currentUserId: string }) => {
  const [selectedChat, setSelectedChat] = useState<{chat: Chat, otherUser: User} | null>(null);

  if (!currentUserId) {
    return null; // Handled by App.tsx
  }

  if (selectedChat) {
    return (
      <ChatRoomScreen 
        chatId={selectedChat.chat.id}
        currentUserId={currentUserId}
        otherUser={selectedChat.otherUser}
        onBack={() => setSelectedChat(null)}
      />
    );
  }

  return (
    <ChatListScreen 
      currentUserId={currentUserId}
      onSelectChat={(chat, otherUser) => setSelectedChat({ chat, otherUser })}
      onNewChat={() => {
        Alert.alert("New Chat", "Search for a user by email to start a new chat.");
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  }
});
