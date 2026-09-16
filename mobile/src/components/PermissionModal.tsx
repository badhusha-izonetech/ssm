import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { colors, radius, spacing } from '../theme/theme';

interface PermissionModalProps {
  visible: boolean;
  type: 'location' | 'camera' | 'microphone' | 'camera_microphone';
  title?: string;
  message?: string;
  onGrant: () => void | Promise<void>;
  onClose?: () => void;
  loading?: boolean;
}

export default function PermissionModal({
  visible,
  type,
  title,
  message,
  onGrant,
  onClose,
  loading = false,
}: PermissionModalProps) {
  if (!visible) return null;

  const iconName: keyof typeof Ionicons.glyphMap =
    type === 'location'
      ? 'location-outline'
      : type === 'microphone'
      ? 'mic-outline'
      : type === 'camera_microphone'
      ? 'videocam-outline'
      : 'camera-outline';

  const defaultTitle =
    type === 'location'
      ? 'Enable Location Services'
      : type === 'microphone'
      ? 'Enable Microphone Access'
      : type === 'camera_microphone'
      ? 'Camera & Microphone Access'
      : 'Enable Camera Access';

  const defaultMessage =
    type === 'location'
      ? 'Accurate GPS location is required to calculate travel distance, verify arrival at client sites, and maintain field security records.'
      : type === 'camera_microphone'
      ? 'Camera and audio access are required to record panoramic 360° site video proof, installation structures, and equipment status.'
      : 'Camera access is required to take tamper-proof arrival proof selfies and detailed site photos.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Glowing Icon Container */}
          <View style={styles.iconCircle}>
            <Ionicons name={iconName} size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>{title || defaultTitle}</Text>
          <Text style={styles.message}>{message || defaultMessage}</Text>

          <View style={styles.actionColumn}>
            <Button
              title="Grant Access Now"
              variant="primary"
              icon="shield-checkmark-outline"
              onPress={onGrant}
              loading={loading}
              style={styles.actionBtn}
            />

            <Button
              title="Open Phone Settings"
              variant="outline"
              icon="settings-outline"
              onPress={() => Linking.openSettings()}
              style={styles.settingsBtn}
            />

            {onClose && (
              <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.dismissBtn}>
                <Text style={styles.dismissText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    width: Math.min(width - 32, 380),
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(2, 132, 199, 0.22)',
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(2, 132, 199, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actionColumn: {
    width: '100%',
    gap: spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
  settingsBtn: {
    width: '100%',
    borderColor: 'rgba(203, 213, 225, 0.9)',
    backgroundColor: '#FFFFFF',
  },
  dismissBtn: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
    marginTop: 4,
  },
  dismissText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
