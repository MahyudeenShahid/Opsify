import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  User, Mail, Lock, LogOut, Shield, ChevronLeft,
  CheckCircle, Edit2, Bell, Info, Zap,
} from 'lucide-react-native';
import {
  updateProfile, sendPasswordResetEmail, signOut,
  updateEmail, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { Theme } from '../core/theme';

interface Props {
  onBack: () => void;
}

export const AccountSettingsScreen: React.FC<Props> = ({ onBack }) => {
  const user = auth.currentUser!;
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isResetingPassword, setIsResetingPassword] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const initials = (displayName || user.email || '?').slice(0, 2).toUpperCase();

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setIsSavingName(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      setNameSaved(true);
      Animated.sequence([
        Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setNameSaved(false));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    Alert.alert(
      'Reset Password',
      `Send a password reset email to ${user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            setIsResetingPassword(true);
            try {
              await sendPasswordResetEmail(auth, user.email!);
              Alert.alert('✅ Email Sent', 'Check your inbox for the password reset link.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setIsResetingPassword(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut(auth);
            } catch (e: any) {
              Alert.alert('Error', e.message);
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={20} color={Theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Account Settings</Text>
          <Text style={styles.pageSubtitle}>Manage your profile and preferences</Text>
        </View>
      </Animated.View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <LinearGradient colors={Theme.gradients.primary} style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
        <View style={styles.avatarDot} />
        <Text style={styles.userName}>{displayName || 'Your Name'}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.verifiedBadge}>
          <Shield size={11} color={Theme.colors.primary} />
          <Text style={styles.verifiedText}>{user.emailVerified ? 'Verified Account' : 'Account Active'}</Text>
        </View>
      </View>

      {/* Profile Settings Card */}
      <View style={styles.card}>
        <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
        <View style={styles.cardHeader}>
          <User size={16} color={Theme.colors.primary} />
          <Text style={styles.cardTitle}>Profile</Text>
        </View>

        <Text style={styles.fieldLabel}>Display Name</Text>
        <View style={styles.inputRow}>
          <Edit2 size={14} color={Theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor={Theme.colors.textMuted}
          />
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(0,230,118,0.12)', borderColor: Theme.colors.primary }]}
          onPress={handleSaveName}
          disabled={isSavingName}
        >
          {isSavingName
            ? <ActivityIndicator size="small" color={Theme.colors.primary} />
            : <><CheckCircle size={15} color={Theme.colors.primary} /><Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>Save Name</Text></>
          }
        </TouchableOpacity>

        {nameSaved && (
          <Animated.View style={[styles.successMsg, { opacity: successAnim }]}>
            <Text style={styles.successMsgText}>✅ Display name updated!</Text>
          </Animated.View>
        )}
      </View>

      {/* Security Card */}
      <View style={styles.card}>
        <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
        <View style={styles.cardHeader}>
          <Lock size={16} color={Theme.colors.secondary} />
          <Text style={styles.cardTitle}>Security</Text>
        </View>

        <View style={styles.infoRow}>
          <Mail size={14} color={Theme.colors.textMuted} />
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{user.email}</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: Theme.colors.secondary, backgroundColor: 'rgba(0,176,255,0.08)' }]}
          onPress={handlePasswordReset}
          disabled={isResetingPassword}
        >
          {isResetingPassword
            ? <ActivityIndicator size="small" color={Theme.colors.secondary} />
            : <><Lock size={15} color={Theme.colors.secondary} /><Text style={[styles.actionBtnText, { color: Theme.colors.secondary }]}>Send Password Reset Email</Text></>
          }
        </TouchableOpacity>
      </View>

      {/* App Info Card */}
      <View style={styles.card}>
        <LinearGradient colors={['rgba(26,34,52,0.95)', 'rgba(17,22,34,0.95)']} style={StyleSheet.absoluteFill} />
        <View style={styles.cardHeader}>
          <Info size={16} color={Theme.colors.textMuted} />
          <Text style={styles.cardTitle}>About</Text>
        </View>
        <View style={styles.infoRow}>
          <Zap size={14} color={Theme.colors.primary} />
          <Text style={styles.infoLabel}>App</Text>
          <Text style={styles.infoValue}>Opsify ERP v2.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Shield size={14} color={Theme.colors.textMuted} />
          <Text style={styles.infoLabel}>Data</Text>
          <Text style={styles.infoValue}>Firebase Firestore (per-user)</Text>
        </View>
        <View style={styles.infoRow}>
          <Bell size={14} color={Theme.colors.textMuted} />
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{user.uid.slice(0, 16)}...</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={isSigningOut}>
        <LinearGradient colors={['rgba(255,42,85,0.12)', 'rgba(255,42,85,0.06)']} style={StyleSheet.absoluteFill} />
        {isSigningOut
          ? <ActivityIndicator size="small" color={Theme.colors.error} />
          : <><LogOut size={18} color={Theme.colors.error} /><Text style={styles.signOutText}>Sign Out</Text></>
        }
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: Theme.spacing.md, paddingBottom: 120, paddingTop: Theme.spacing.sm },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Theme.spacing.xl, paddingTop: Theme.spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: Theme.colors.text, fontSize: 22, fontWeight: '900' },
  pageSubtitle: { color: Theme.colors.textMuted, fontSize: 12, marginTop: 2 },

  avatarSection: { alignItems: 'center', marginBottom: Theme.spacing.xl },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#000', fontSize: 32, fontWeight: '900' },
  avatarDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Theme.colors.primary, position: 'absolute', top: 74, right: '37%', borderWidth: 2, borderColor: Theme.colors.background },
  userName: { color: Theme.colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  userEmail: { color: Theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Theme.borderRadius.pill, borderWidth: 1, borderColor: 'rgba(0,230,118,0.3)', backgroundColor: 'rgba(0,230,118,0.08)' },
  verifiedText: { color: Theme.colors.primary, fontSize: 11, fontWeight: '700' },

  card: { borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, marginBottom: Theme.spacing.md, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Theme.spacing.md },
  cardTitle: { color: Theme.colors.text, fontSize: 15, fontWeight: '800' },

  fieldLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Theme.borderRadius.md, borderWidth: 1, borderColor: Theme.colors.border, paddingHorizontal: 12, height: 48, marginBottom: Theme.spacing.sm },
  input: { flex: 1, color: Theme.colors.text, fontSize: 15, fontWeight: '600' },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: Theme.borderRadius.md, borderWidth: 1, marginTop: 4 },
  actionBtnText: { fontWeight: '700', fontSize: 14 },
  successMsg: { alignItems: 'center', marginTop: 8 },
  successMsgText: { color: Theme.colors.primary, fontSize: 12, fontWeight: '700' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  infoLabel: { color: Theme.colors.textMuted, fontSize: 12, fontWeight: '700', width: 70 },
  infoValue: { color: Theme.colors.text, fontSize: 12, flex: 1 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: Theme.borderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,42,85,0.4)', overflow: 'hidden', marginTop: 8 },
  signOutText: { color: Theme.colors.error, fontSize: 16, fontWeight: '800' },
});
