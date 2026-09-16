import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError('Enter your Employee ID / username and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name="sunny" size={30} color="#fff" />
          </View>
          <Text style={styles.brand}>SUCCESS SOLAR</Text>
          <Text style={styles.brandSub}>Field Employee App</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome back!</Text>
          <Text style={styles.welcomeSub}>Please login to continue</Text>

          <Text style={styles.fieldLabel}>Employee ID / Username</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. EMP7923"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember((r) => !r)}>
              <Ionicons
                name={remember ? 'checkbox' : 'square-outline'}
                size={18}
                color={remember ? colors.primary : colors.textMuted}
              />
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <Text style={styles.forgot}>Forgot Password?</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
          </TouchableOpacity>

          <Text style={styles.footerNote}>Use the same credentials as the Success Solar ERP portal</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  hero: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brand: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  brandSub: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    flex: 1,
  },
  welcome: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  welcomeSub: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.md },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  rememberRow: { flexDirection: 'row', alignItems: 'center' },
  rememberText: { fontSize: 12, color: colors.textSecondary, marginLeft: 6 },
  forgot: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footerNote: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: spacing.lg },
});
