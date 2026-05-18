import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Search, MessageSquarePlus, ChevronRight } from 'lucide-react-native';

import { Theme } from '../../core/theme';
import { FirebaseChatService, Chat, User } from '../../services/firebaseChatService';

export const ChatListScreen = ({ currentUserId, onSelectChat, onNewChat }: { currentUserId: string, onSelectChat: (chat: Chat, otherUser: User) => void, onNewChat: () => void }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const unsubscribe = FirebaseChatService.subscribeToChats(currentUserId, (fetchedChats) => {
      setChats(fetchedChats);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUserId]);

  const filteredChats = chats.filter(chat => {
    const otherUser = chat.users?.[0];
    return otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase()) || otherUser?.phoneNumber.includes(searchQuery);
  });

  const renderChatItem = ({ item, index }: { item: Chat, index: number }) => {
    const otherUser = item.users?.[0];
    if (!otherUser) return null;

    const date = item.updatedAt ? new Date(item.updatedAt.toDate()) : new Date();
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return <AnimatedChatRow item={item} otherUser={otherUser} timeString={timeString} index={index} onPress={() => onSelectChat(item, otherUser)} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OmniChat</Text>
        <TouchableOpacity style={styles.newChatButton} onPress={onNewChat}>
          <MessageSquarePlus color="#000" size={18} />
          <Text style={styles.newChatText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Search color={Theme.colors.textMuted} size={18} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <Animated.FlatList
          style={{ opacity: fadeAnim }}
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No active conversations found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const AnimatedChatRow = ({ item, otherUser, timeString, index, onPress }: any) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, delay: index * 50, useNativeDriver: true })
    ]).start();
  }, []);

  return (
    <TouchableOpacity 
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
    >
      <Animated.View style={[styles.chatItem, { opacity: opacityAnim, transform: [{ translateY: slideAnim }, { scale }] }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherUser.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{otherUser.name}</Text>
            <Text style={styles.chatTime}>{timeString}</Text>
          </View>
          <View style={styles.messagePreviewRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage || 'No messages yet'}</Text>
            <ChevronRight color={Theme.colors.border} size={16} />
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Theme.spacing.md, paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.sm },
  title: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  newChatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Theme.borderRadius.pill, ...Theme.shadows.glow },
  newChatText: { color: '#000', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
  searchContainer: { paddingHorizontal: Theme.spacing.md, paddingBottom: Theme.spacing.md },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.pill, borderWidth: 1, borderColor: Theme.colors.border, paddingHorizontal: Theme.spacing.md, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  listContent: { paddingHorizontal: Theme.spacing.md, paddingBottom: 100 },
  chatItem: { flexDirection: 'row', padding: Theme.spacing.md, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, marginBottom: Theme.spacing.sm, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Theme.colors.primaryGlow, borderWidth: 1, borderColor: Theme.colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Theme.spacing.md },
  avatarText: { color: Theme.colors.primary, fontSize: 22, fontWeight: '900' },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  chatTime: { fontSize: 11, color: Theme.colors.textMuted },
  messagePreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { flex: 1, fontSize: 14, color: Theme.colors.textMuted },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Theme.colors.textMuted, fontSize: 14 }
});
