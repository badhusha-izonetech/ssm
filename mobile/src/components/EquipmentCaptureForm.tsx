import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { EquipmentItem, EquipmentRecord } from '../siteVisit/types';
import Card from './Card';
import Button from './Button';
import EmptyState from './EmptyState';
import SyncPendingNote from './SyncPendingNote';
import { colors, radius, spacing } from '../theme/theme';
import { formatDateTime } from '../utils/format';

interface EquipmentCaptureFormProps {
  record: EquipmentRecord;
  photoLabel: string;
  remarksLabel: string;
  remarksPlaceholder: string;
  confirmLabel: string;
  /** Called with the raw local image uri after capture — caller decides whether/how to upload it (a real fmId may not exist yet for the technician's pre-tracking equipment check). */
  onCapturePhoto: (uri: string) => Promise<void>;
  onAddItem: (item: EquipmentItem) => Promise<void>;
  onRemoveItem: (id: string) => Promise<void>;
  onRemarksChange: (remarks: string) => void;
  onConfirm: () => Promise<void>;
}

export default function EquipmentCaptureForm({
  record,
  photoLabel,
  remarksLabel,
  remarksPlaceholder,
  confirmLabel,
  onCapturePhoto,
  onAddItem,
  onRemoveItem,
  onRemarksChange,
  onConfirm,
}: EquipmentCaptureFormProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState('');
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleAddPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Please allow camera access to capture the equipment photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    setBusyPhoto(true);
    try {
      await onCapturePhoto(result.assets[0].uri);
    } finally {
      setBusyPhoto(false);
    }
  }

  async function handleAddItem() {
    if (!name.trim()) return;
    await onAddItem({ id: `${Date.now()}`, name: name.trim(), quantity: quantity.trim() || '1', condition: condition.trim() || 'Good' });
    setName('');
    setQuantity('');
    setCondition('');
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View>
      {/* Individual add-item / remove-item / photo-capture / remarks edits
          above are real backend calls (uploadFieldFile, etc.) as they
          happen — only the *confirmation* record itself is pending until
          "Confirm" is tapped, so this only shows before that point (§D). */}
      {!record.confirmedAt && (
        <SyncPendingNote label="Not yet confirmed — tap Confirm below to save this equipment record to the backend" />
      )}

      <Card style={styles.photoCard} padded>
        {record.photo ? (
          <Image source={{ uri: record.photo.uri }} style={styles.photo} />
        ) : (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={handleAddPhoto} disabled={busyPhoto}>
            {busyPhoto ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.photoPlaceholderText}>{photoLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {record.photo && (
          <TouchableOpacity style={styles.retakeBtn} onPress={handleAddPhoto} disabled={busyPhoto}>
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        )}
      </Card>

      <Text style={styles.sectionTitle}>Item details</Text>
      <Card padded>
        <View style={styles.itemForm}>
          <TextInput style={styles.itemInput} placeholder="Item name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
          <View style={styles.itemRow2}>
            <TextInput
              style={[styles.itemInput, { flex: 1, marginRight: spacing.sm }]}
              placeholder="Quantity"
              placeholderTextColor={colors.textMuted}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.itemInput, { flex: 1 }]}
              placeholder="Condition"
              placeholderTextColor={colors.textMuted}
              value={condition}
              onChangeText={setCondition}
            />
          </View>
          <Button title="Add Item" variant="outline" icon="add" onPress={handleAddItem} disabled={!name.trim()} />
        </View>

        {record.items.length === 0 ? (
          <EmptyState icon="cube-outline" title="No items added yet" />
        ) : (
          record.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  Qty {item.quantity} · {item.condition}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onRemoveItem(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </Card>

      <Text style={styles.sectionTitle}>{remarksLabel}</Text>
      <Card padded>
        <TextInput
          style={styles.remarksInput}
          multiline
          placeholder={remarksPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={record.remarks}
          onChangeText={onRemarksChange}
        />
      </Card>

      {record.confirmedAt ? (
        <Text style={styles.confirmedText}>Confirmed {formatDateTime(record.confirmedAt)}</Text>
      ) : (
        <Button title={confirmLabel} icon="checkmark-circle" onPress={handleConfirm} loading={confirming} style={{ marginTop: spacing.lg }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoCard: { alignItems: 'center', marginTop: spacing.md },
  photo: { width: '100%', height: 160, borderRadius: radius.md },
  photoPlaceholder: { width: '100%', height: 140, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 12, color: colors.textSecondary, marginTop: 8, fontWeight: '600' },
  retakeBtn: { marginTop: spacing.sm },
  retakeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase' },
  itemForm: { marginBottom: spacing.sm },
  itemInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemRow2: { flexDirection: 'row' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  itemName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  itemMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  remarksInput: { minHeight: 70, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top' },
  confirmedText: { fontSize: 11, color: colors.success, textAlign: 'center', marginTop: spacing.md },
});
