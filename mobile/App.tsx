// Registering the background task must happen before any component renders
// (see src/tracking/locationTask.ts) — this import has to stay first.
import './src/tracking/locationTask';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { attachMediaQueueAutoDrain } from './src/tracking/mediaUploadQueue';
import { attachMutationQueueAutoDrain } from './src/tracking/pendingMutationQueue';
import { uploadFieldFile, uploadFieldVideo, uploadSelfie } from './src/api/fieldMovements';
import * as fieldMovementsApi from './src/api/fieldMovements';

// Auto-retry any media upload that failed while offline, the moment the
// network reconnects or the app comes back to the foreground — mirrors the
// GPS queue's own reconnect-triggered drain (§30). Registered once at the
// app root rather than per-screen so it keeps retrying even if the
// employee has navigated away from where the upload was captured.
//
// Every branch below passes entry.operationId through as the idempotency
// key. Without it, a drain-triggered retry (as opposed to the immediate
// first attempt made by the capturing screen) would hit the server with no
// client_operation_id at all and could create a duplicate photo/video/
// measurement/document/selfie row if the original attempt had actually
// succeeded server-side but the app never received the response.
attachMediaQueueAutoDrain(async (entry) => {
  if (entry.endpoint === 'photo') {
    await uploadFieldFile(entry.fieldMovementId, entry.fileUri, entry.fileName, entry.mimeType, entry.operationId);
  } else if (entry.endpoint === 'selfie') {
    const f = entry.extraFields || {};
    await uploadSelfie(entry.fieldMovementId, entry.fileUri, entry.fileName, {
      latitude: Number(f.latitude), longitude: Number(f.longitude),
      accuracy: Number(f.accuracy), capturedAt: f.capturedAt,
    }, entry.operationId);
  } else if (entry.endpoint === 'video') {
    await uploadFieldVideo(entry.fieldMovementId, entry.fileUri, entry.fileName, entry.mimeType, entry.operationId);
  } else if (entry.endpoint === 'measurements') {
    await fieldMovementsApi.uploadMeasurement(
      entry.fieldMovementId, entry.fileUri, entry.fileName,
      (entry.extraFields?.category as any) || 'Other', entry.operationId
    );
  } else if (entry.endpoint === 'documents') {
    await fieldMovementsApi.uploadDocument(entry.fieldMovementId, entry.fileUri, entry.fileName, entry.mimeType, entry.operationId);
  }
});

// Same reconnect/foreground-triggered drain, for the plain-JSON field
// mutations (Site Notes, Work Progress stage updates) that don't involve a
// file upload — see src/tracking/pendingMutationQueue.ts.
attachMutationQueueAutoDrain(async (entry) => {
  if (entry.kind === 'note') {
    const payload = entry.payload as { note: string };
    await fieldMovementsApi.addNote(entry.fieldMovementId, payload.note, entry.operationId);
  } else if (entry.kind === 'work_update') {
    const payload = entry.payload as { stage: string; remarks?: string; latitude?: number; longitude?: number; accuracy?: number };
    await fieldMovementsApi.addWorkUpdate(entry.fieldMovementId, payload, entry.operationId);
  }
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
