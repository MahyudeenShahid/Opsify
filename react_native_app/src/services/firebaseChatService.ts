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
  email: string;
  emailLowercase: string;
  phoneNumber?: string;
  createdAt?: any;
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

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const FirebaseChatService = {
  // --- USER MANAGEMENT ---
  async createUser(uid: string, name: string, email: string, phoneNumber?: string) {
    const normalizedEmail = normalizeEmail(email);
    if (!uid || !normalizedEmail) {
      throw new Error('A valid user id and email are required.');
    }

    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid,
      name,
      email: normalizedEmail,
      emailLowercase: normalizedEmail,
      ...(phoneNumber ? { phoneNumber } : {}),
      createdAt: serverTimestamp()
    }, { merge: true });
  },

  async getUser(uid: string): Promise<User | null> {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<User>;
      const email = data.email || '';
      return {
        uid: data.uid || uid,
        name: data.name || 'Unknown User',
        email,
        emailLowercase: data.emailLowercase || email.toLowerCase(),
        phoneNumber: data.phoneNumber,
        createdAt: data.createdAt,
      };
    }
    return null;
  },

  async searchUsersByEmail(email: string): Promise<User[]> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return [];

    const byLowercase = query(collection(db, 'users'), where('emailLowercase', '==', normalizedEmail));
    const byEmail = query(collection(db, 'users'), where('email', '==', normalizedEmail));

    const [lowercaseSnap, emailSnap] = await Promise.all([getDocs(byLowercase), getDocs(byEmail)]);
    const users = [...lowercaseSnap.docs, ...emailSnap.docs].map(d => d.data() as User);
    return users.filter((user, index, array) => array.findIndex(candidate => candidate.uid === user.uid) === index);
  },

  async searchUsersByPhone(phoneNumber: string): Promise<User[]> {
    const q = query(collection(db, 'users'), where('phoneNumber', '==', phoneNumber.trim()));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as User);
  },

  // --- CHAT MANAGEMENT ---
  async createOrGetChat(currentUserId: string, targetUserId: string): Promise<string> {
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
    const chatId = [currentUserId, targetUserId].sort().join('__');
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        participants: [currentUserId, targetUserId],
        lastMessage: '',
        lastMessageTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
    }

    return chatId;
  },

  // Listen to all chats for a user
  subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );

    return onSnapshot(q, async (snapshot) => {
      const chats: Chat[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();

        const participants: string[] = Array.isArray(data.participants) ? data.participants : [];
        const users = (await Promise.all(
          participants
            .filter((participantId: string) => participantId !== userId)
            .map(async (participantId: string) => this.getUser(participantId))
        )).filter((participant): participant is User => Boolean(participant));

        chats.push({
          id: docSnap.id,
          participants,
          lastMessage: data.lastMessage,
          lastMessageTimestamp: data.lastMessageTimestamp,
          updatedAt: data.updatedAt,
          users
        });
      }

      chats.sort((a, b) => {
        const timeA = toMillis(a.updatedAt);
        const timeB = toMillis(b.updatedAt);
        return timeB - timeA;
      });

      callback(chats);
    });
  },

  // --- MESSAGE MANAGEMENT ---
  async sendMessage(chatId: string, senderId: string, text: string) {
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
  },

  /**
   * Fetch ALL messages from a chat thread for deep scanning.
   * Returns messages with ISO timestamp strings for cursor comparison.
   */
  async getFullMessages(chatId: string, senderNames: Record<string, string> = {}): Promise<any[]> {
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => {
      const data = docSnap.data();
      const ts = data.timestamp;
      let timestamp_iso = '';
      try {
        if (ts && typeof ts.toDate === 'function') {
          timestamp_iso = ts.toDate().toISOString();
        } else if (ts) {
          timestamp_iso = new Date(ts).toISOString();
        }
      } catch {}
      return {
        id: docSnap.id,
        text: data.text || '',
        senderId: data.senderId || '',
        senderName: senderNames[data.senderId] || data.senderId || 'unknown',
        timestamp_iso,
        status: data.status || 'sent',
      };
    });
  },

  /**
   * Get all chats with their full message history — for System 1 deep scan.
   */
  async getAllChatsWithMessages(userId: string): Promise<any[]> {
    const chatsRef = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId)
    );
    const chatsSnap = await getDocs(chatsRef);
    const result: any[] = [];

    for (const chatDoc of chatsSnap.docs) {
      const data = chatDoc.data();
      const participants: string[] = data.participants || [];

      // Resolve other user names
      const senderNames: Record<string, string> = {};
      const otherParticipants = participants.filter(pid => pid !== userId);
      for (const pid of otherParticipants) {
        const u = await this.getUser(pid);
        if (u) senderNames[pid] = u.name;
      }
      senderNames[userId] = 'me';

      const messages = await this.getFullMessages(chatDoc.id, senderNames);

      const users = Object.entries(senderNames)
        .filter(([uid]) => uid !== userId)
        .map(([uid, name]) => ({ uid, name }));

      result.push({
        id: chatDoc.id,
        users,
        messages,
        lastMessage: data.lastMessage || '',
        updatedAt: data.updatedAt || null,
      });
    }

    return result;
  },
};

