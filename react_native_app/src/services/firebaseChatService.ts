import { db } from '../config/firebaseConfig';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  serverTimestamp, 
  orderBy, 
  onSnapshot,
  updateDoc
} from 'firebase/firestore';

export interface User {
  uid: string;
  name: string;
  phoneNumber: string;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTimestamp: any;
  updatedAt: any;
  users?: User[]; // Joined data for UI
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
  status: 'sent' | 'delivered' | 'read';
}

// --- MOCK IN-MEMORY SYSTEM FOR DEMO MODE ---
const mockUsers: Record<string, User> = {
  'wholesaler_alice': { uid: 'wholesaler_alice', name: 'Alice (Dairy Supplier)', phoneNumber: '+92 300 1234567' },
  'customer_bob': { uid: 'customer_bob', name: 'Bob Malone (Hardware Buyer)', phoneNumber: '+92 312 9876543' },
  'distributor_charlie': { uid: 'distributor_charlie', name: 'Charlie (Alpha Depot Manager)', phoneNumber: '+92 333 4567890' }
};

let mockChats: Chat[] = [
  {
    id: 'chat_alice',
    participants: ['demo-user-id', 'wholesaler_alice'],
    lastMessage: 'Hi, did you get the dairy reorder request?',
    lastMessageTimestamp: { toDate: () => new Date(Date.now() - 5 * 60 * 1000) },
    updatedAt: { toDate: () => new Date(Date.now() - 5 * 60 * 1000) },
    users: [mockUsers['wholesaler_alice']]
  },
  {
    id: 'chat_bob',
    participants: ['demo-user-id', 'customer_bob'],
    lastMessage: 'Thanks for the discount on copper wires!',
    lastMessageTimestamp: { toDate: () => new Date(Date.now() - 2 * 60 * 60 * 1000) },
    updatedAt: { toDate: () => new Date(Date.now() - 2 * 60 * 60 * 1000) },
    users: [mockUsers['customer_bob']]
  },
  {
    id: 'chat_charlie',
    participants: ['demo-user-id', 'distributor_charlie'],
    lastMessage: 'Stock is ready at Alpha Depot.',
    lastMessageTimestamp: { toDate: () => new Date(Date.now() - 24 * 60 * 60 * 1000) },
    updatedAt: { toDate: () => new Date(Date.now() - 24 * 60 * 60 * 1000) },
    users: [mockUsers['distributor_charlie']]
  }
];

let mockMessages: Record<string, Message[]> = {
  'chat_alice': [
    { id: 'm1', senderId: 'wholesaler_alice', text: 'Hi there! I saw we got low on Full Cream Milk.', timestamp: { toDate: () => new Date(Date.now() - 20 * 60 * 1000) }, status: 'read' },
    { id: 'm2', senderId: 'wholesaler_alice', text: 'Did you send the reorder request through the AI agent?', timestamp: { toDate: () => new Date(Date.now() - 19 * 60 * 1000) }, status: 'read' },
    { id: 'm3', senderId: 'demo-user-id', text: 'Yes, the AI generated the bid. Please check.', timestamp: { toDate: () => new Date(Date.now() - 15 * 60 * 1000) }, status: 'read' },
    { id: 'm4', senderId: 'wholesaler_alice', text: 'Hi, did you get the dairy reorder request?', timestamp: { toDate: () => new Date(Date.now() - 5 * 60 * 1000) }, status: 'read' }
  ],
  'chat_bob': [
    { id: 'm5', senderId: 'customer_bob', text: 'Hey, can I buy 50 meters of Copper Wire?', timestamp: { toDate: () => new Date(Date.now() - 3 * 60 * 60 * 1000) }, status: 'read' },
    { id: 'm6', senderId: 'demo-user-id', text: 'Sure, let me check the stock at Alpha Depot.', timestamp: { toDate: () => new Date(Date.now() - 2.5 * 60 * 60 * 1000) }, status: 'read' },
    { id: 'm7', senderId: 'demo-user-id', text: 'Yes, we have 100 meters in stock.', timestamp: { toDate: () => new Date(Date.now() - 2.2 * 60 * 60 * 1000) }, status: 'read' },
    { id: 'm8', senderId: 'customer_bob', text: 'Thanks for the discount on copper wires!', timestamp: { toDate: () => new Date(Date.now() - 2 * 60 * 60 * 1000) }, status: 'read' }
  ],
  'chat_charlie': [
    { id: 'm9', senderId: 'distributor_charlie', text: 'Stock is ready at Alpha Depot.', timestamp: { toDate: () => new Date(Date.now() - 24 * 60 * 60 * 1000) }, status: 'read' }
  ]
};

// Registered listeners
let chatListeners: Record<string, (chats: Chat[]) => void> = {};
let messageListeners: Record<string, (messages: Message[]) => void> = {};

export const FirebaseChatService = {
  // --- USER MANAGEMENT ---
  async createUser(uid: string, name: string, phoneNumber: string) {
    if (uid === 'demo-user-id') return;
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid,
      name,
      phoneNumber,
      createdAt: serverTimestamp()
    }, { merge: true });
  },

  async getUser(uid: string): Promise<User | null> {
    if (uid.startsWith('wholesaler_') || uid.startsWith('customer_') || uid.startsWith('distributor_')) {
      return mockUsers[uid] || null;
    }
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as User;
    }
    return null;
  },

  async searchUsersByPhone(phoneNumber: string): Promise<User[]> {
    const q = query(collection(db, 'users'), where('phoneNumber', '==', phoneNumber));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as User);
  },

  // --- CHAT MANAGEMENT ---
  async createOrGetChat(currentUserId: string, targetUserId: string): Promise<string> {
    if (currentUserId === 'demo-user-id') {
      const existing = mockChats.find(c => c.participants.includes(targetUserId));
      if (existing) return existing.id;

      const newId = `chat_${Date.now()}`;
      const targetUser = mockUsers[targetUserId] || { uid: targetUserId, name: 'New Customer', phoneNumber: '' };
      const newChat: Chat = {
        id: newId,
        participants: [currentUserId, targetUserId],
        lastMessage: '',
        lastMessageTimestamp: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
        users: [targetUser]
      };
      mockChats.push(newChat);
      mockMessages[newId] = [];
      
      // Notify listeners
      if (chatListeners[currentUserId]) {
        chatListeners[currentUserId]([...mockChats]);
      }
      return newId;
    }

    // Check if chat already exists
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId)
    );
    const snap = await getDocs(q);
    
    let existingChatId = null;
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.participants.includes(targetUserId)) {
        existingChatId = doc.id;
      }
    });

    if (existingChatId) return existingChatId;

    // Create new chat
    const newChatRef = await addDoc(collection(db, 'chats'), {
      participants: [currentUserId, targetUserId],
      lastMessage: '',
      lastMessageTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return newChatRef.id;
  },

  // Listen to all chats for a user
  subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
    if (userId === 'demo-user-id') {
      chatListeners[userId] = callback;
      // Trigger immediately
      callback([...mockChats]);
      return () => {
        delete chatListeners[userId];
      };
    }

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, async (snapshot) => {
      const chats: Chat[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Fetch user details for participants (basic implementation)
        const users: User[] = [];
        for (const pid of data.participants) {
          if (pid !== userId) {
             const u = await this.getUser(pid);
             if (u) users.push(u);
          }
        }

        chats.push({
          id: docSnap.id,
          participants: data.participants,
          lastMessage: data.lastMessage,
          lastMessageTimestamp: data.lastMessageTimestamp,
          updatedAt: data.updatedAt,
          users
        });
      }
      callback(chats);
    });
  },

  // --- MESSAGE MANAGEMENT ---
  async sendMessage(chatId: string, senderId: string, text: string) {
    if (senderId === 'demo-user-id') {
      const newMsg: Message = {
        id: `msg_${Date.now()}`,
        senderId,
        text,
        timestamp: { toDate: () => new Date() },
        status: 'sent'
      };
      
      if (!mockMessages[chatId]) mockMessages[chatId] = [];
      mockMessages[chatId].push(newMsg);

      // Update chat preview
      mockChats = mockChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            lastMessage: text,
            lastMessageTimestamp: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() }
          };
        }
        return c;
      });

      // Trigger active listeners
      if (messageListeners[chatId]) {
        messageListeners[chatId]([...mockMessages[chatId]]);
      }
      if (chatListeners[senderId]) {
        chatListeners[senderId]([...mockChats]);
      }

      // Simulated Auto-Reply from Customer/Supplier for engaging demo!
      setTimeout(() => {
        let replyText = "I'm looking into this. Thank you!";
        let targetReplier = 'customer_bob';

        if (chatId === 'chat_alice') {
          replyText = "Great! Let me check the reorder levels and send the invoice.";
          targetReplier = 'wholesaler_alice';
        } else if (chatId === 'chat_charlie') {
          replyText = "Understood. The warehouse dispatch details are logged in the Inventory tab.";
          targetReplier = 'distributor_charlie';
        }

        const replyMsg: Message = {
          id: `msg_${Date.now() + 1}`,
          senderId: targetReplier,
          text: replyText,
          timestamp: { toDate: () => new Date() },
          status: 'read'
        };

        mockMessages[chatId].push(replyMsg);
        
        mockChats = mockChats.map(c => {
          if (c.id === chatId) {
            return {
              ...c,
              lastMessage: replyText,
              lastMessageTimestamp: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() }
            };
          }
          return c;
        });

        if (messageListeners[chatId]) {
          messageListeners[chatId]([...mockMessages[chatId]]);
        }
        if (chatListeners[senderId]) {
          chatListeners[senderId]([...mockChats]);
        }
      }, 2500);

      return;
    }

    const messagesRef = collection(db, `chats/${chatId}/messages`);
    
    // Add message
    await addDoc(messagesRef, {
      senderId,
      text,
      timestamp: serverTimestamp(),
      status: 'sent'
    });

    // Update chat last message
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      lastMessage: text,
      lastMessageTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    if (chatId.startsWith('chat_')) {
      messageListeners[chatId] = callback;
      callback([...(mockMessages[chatId] || [])]);
      return () => {
        delete messageListeners[chatId];
      };
    }

    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      callback(messages);
    });
  },

  async markMessagesAsRead(chatId: string, currentUserId: string) {
    if (currentUserId === 'demo-user-id') {
      if (mockMessages[chatId]) {
        mockMessages[chatId] = mockMessages[chatId].map(m => {
          if (m.senderId !== currentUserId) {
            return { ...m, status: 'read' };
          }
          return m;
        });
        if (messageListeners[chatId]) {
          messageListeners[chatId]([...mockMessages[chatId]]);
        }
      }
      return;
    }

    // In a real app, query unread messages not from current user and update them
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      where('status', 'in', ['sent', 'delivered'])
    );
    
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      if (docSnap.data().senderId !== currentUserId) {
         await updateDoc(docSnap.ref, { status: 'read' });
      }
    }
  }
};
