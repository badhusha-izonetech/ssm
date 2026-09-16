import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, LinkingOptions, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Linking } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getActiveTrackingSessionId } from '../tracking/locationTask';
import { attachNotificationTapHandler } from '../api/push';

import LoginScreen from '../screens/LoginScreen';
import TodayWorkScreen from '../screens/TodayWorkScreen';
import StartTrackingScreen from '../screens/StartTrackingScreen';
import TrackingLiveScreen from '../screens/TrackingLiveScreen';
import MarkDestinationScreen from '../screens/MarkDestinationScreen';
import ReturnDecisionScreen from '../screens/ReturnDecisionScreen';
import SiteVisitScreen from '../screens/SiteVisitScreen';
import SiteSelfieProofScreen from '../screens/SiteSelfieProofScreen';
import SitePhotosScreen from '../screens/SitePhotosScreen';
import SiteViewVideoScreen from '../screens/SiteViewVideoScreen';
import MeasurementsScreen from '../screens/MeasurementsScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import SiteNotesScreen from '../screens/SiteNotesScreen';
import MaterialsEquipmentScreen from '../screens/MaterialsEquipmentScreen';
import LeadSiteVisitScreen from '../screens/LeadSiteVisitScreen';
import SiteVisitMaterialsScreen from '../screens/SiteVisitMaterialsScreen';
import EquipmentBeforeScreen from '../screens/EquipmentBeforeScreen';
import ProjectSelectionScreen from '../screens/ProjectSelectionScreen';
import EquipmentStageScreen from '../screens/EquipmentStageScreen';
import SiteEvidenceReviewScreen from '../screens/SiteEvidenceReviewScreen';
import WorkProgressScreen from '../screens/WorkProgressScreen';
import PeriodicProgressPhotoScreen from '../screens/PeriodicProgressPhotoScreen';
import FieldTrackingHistoryScreen from '../screens/FieldTrackingHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AssignedWorkInboxScreen from '../screens/AssignedWorkInboxScreen';
import SiteVisitFormScreen from '../screens/SiteVisitFormScreen';
import ContinuousLiveTrackingScreen from '../screens/ContinuousLiveTrackingScreen';

export type RootStackParamList = {
  Login: undefined;
  TodayWork: undefined;
  AssignedWorkInbox: undefined;
  ContinuousLiveTracking: { fieldMovementId: string };
  StartTracking: { projectId?: string; leadId?: string; customerName?: string; destination?: string; workType?: 'DIRECT MARKET' | 'SITE VISIT' } | undefined;
  TrackingLive: { fieldMovementId: string; mode?: 'outbound' | 'return' };
  MarkDestination: { fieldMovementId: string; distanceMeters?: number };
  ReturnDecision: { fieldMovementId: string };
  SiteVisitHub: { fieldMovementId?: string } | undefined;
  SiteVisit: { fieldMovementId?: string } | undefined;
  SiteSelfieProof: { fieldMovementId: string };
  SitePhotos: { fieldMovementId: string; photoType: 'general' | 'installation' };
  SiteViewVideo: { fieldMovementId: string };
  Measurements: { fieldMovementId: string };
  Documents: { fieldMovementId: string };
  SiteNotes: { fieldMovementId: string };
  MaterialsEquipment: undefined;
  LeadSiteVisit: { mode?: 'materials' | 'start-tracking'; leadId?: string; workType?: 'DIRECT MARKET' | 'SITE VISIT' } | undefined;
  SiteVisitMaterials: { siteVisitId?: string; fieldMovementId?: string };
  SiteVisitForm: { siteVisitId?: string; fieldMovementId?: string };
  EquipmentBefore: { projectId?: string } | undefined;
  ProjectSelection: undefined;
  EquipmentStage: { fieldMovementId: string; stage: 'before' | 'after' };
  SiteEvidenceReview: { fieldMovementId: string };
  WorkProgress: { fieldMovementId: string };
  PeriodicProgressPhoto: { fieldMovementId: string };
  FieldTrackingHistory: undefined;
  Profile: undefined;
};


const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep linking (§33/§F): successsolar://tracking/{fieldMovementId} maps
// directly onto an existing screen/param. successsolar://site-visit/{id}
// maps to the real materials screen for that SiteVisit.
// successsolar://lead/{id} opens the lead picker pre-targeted at that real
// lead (see LeadSiteVisitScreen's auto-pick effect) — the Web ERP launches
// this instead of the generic .../tracking link whenever it already knows
// which lead the Direct Marketing Executive / Site Visitor is acting on.
// successsolar://leads maps to the lead-picker screen with no specific
// target. successsolar://project/{id} doesn't have a corresponding
// standalone screen in this field-execution client (it works off field
// movements / project selection flows, not a project detail view) — falls
// back to TodayWork rather than crashing on an unmapped route (§33's
// required "invalid ID" / unmapped fallback behavior).
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['successsolar://'],
  config: {
    screens: {
      AssignedWorkInbox: 'assigned-work',
      TrackingLive: 'tracking/:fieldMovementId',
      SiteVisitMaterials: 'site-visit/:siteVisitId',
      LeadSiteVisit: 'lead/:leadId?',
      TodayWork: '*',
    },
  },
};

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Resolve a captured deep-link URL into a (screen, params) pair using the
// same route table as `linking.config.screens` above. Kept as an explicit
// regex table (rather than pulling in @react-navigation's path-resolution
// internals) because the route set here is small and fixed.
function resolveDeepLink(url: string | null): { screen: keyof RootStackParamList; params?: object } | null {
  if (!url) return null;
  const path = url.replace(/^[a-zA-Z0-9+.-]+:\/\//, '').replace(/^\/+/, '');
  let m = path.match(/^tracking\/([^/?]+)/);
  if (m) return { screen: 'TrackingLive', params: { fieldMovementId: m[1] } };
  m = path.match(/^site-visit\/([^/?]+)/);
  if (m) return { screen: 'SiteVisitMaterials', params: { siteVisitId: m[1] } };
  if (path === 'assigned-work' || path.startsWith('assigned-work/')) {
    return { screen: 'AssignedWorkInbox' };
  }
  if (path === 'leads' || path.startsWith('leads/') || path.startsWith('leads?')) {
    return { screen: 'LeadSiteVisit' };
  }
  m = path.match(/^lead(?:\/([^/?]+))?(?:$|[/?])/);
  if (m) return { screen: 'LeadSiteVisit', params: m[1] ? { leadId: m[1] } : undefined };
  // Unmapped/invalid path: fall back to TodayWork instead of leaving the
  // user stranded or crashing on an unknown route (§ invalid-ID handling).
  return { screen: 'TodayWork' };
}

export default function RootNavigator() {
  const { employee, loading } = useAuth();
  // App-restart recovery: if the OS killed and relaunched the JS app while a
  // tracking session was active (background task + offline queue survive
  // this independently — see locationTask.ts), land directly on the live
  // tracking screen and let it reconnect, instead of making the employee
  // notice the "in progress" banner and tap it themselves.
  const [resumeFmId, setResumeFmId] = useState<string | null | undefined>(undefined);

  // Deep-link handoff while logged out (§ web→mobile field mobility): a
  // web-triggered app link can arrive before the employee has authenticated
  // (cold start straight into the link, or a session that expired). React
  // Navigation's `linking` prop can only resolve a URL against screens that
  // are currently mounted, and while logged out only the Login screen is
  // registered — so without this, the target URL was silently dropped and
  // the employee landed on TodayWork after logging in instead of the
  // context the link pointed at. This captures the URL the moment it
  // arrives and replays it once the authenticated stack mounts.
  const pendingDeepLink = useRef<string | null>(null);
  const wasAuthed = useRef(false);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) pendingDeepLink.current = url;
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!wasAuthed.current) {
        // Not logged in yet (or mid-login) — hold onto it instead of
        // letting the `linking` prop try (and fail) to resolve it against
        // the unauthenticated stack.
        pendingDeepLink.current = url;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (employee && !wasAuthed.current) {
      wasAuthed.current = true;
      const target = resolveDeepLink(pendingDeepLink.current);
      pendingDeepLink.current = null;
      if (target && navigationRef.isReady()) {
        // @ts-expect-error - params shape is validated per-branch in resolveDeepLink
        navigationRef.navigate(target.screen, target.params);
      }
    }
    if (!employee) {
      wasAuthed.current = false;
    }
  }, [employee]);

  useEffect(() => {
    if (!employee) {
      setResumeFmId(undefined);
      return;
    }
    getActiveTrackingSessionId().then(setResumeFmId);
  }, [employee]);

  useEffect(() => {
    return attachNotificationTapHandler();
  }, []);

  if (loading || (employee && resumeFmId === undefined)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        key={employee ? 'authenticated' : 'unauthenticated'}
        screenOptions={{ headerShown: false }}
        initialRouteName={employee ? 'TodayWork' : 'Login'}
      >
        {employee ? (
          <>
            <Stack.Screen name="TodayWork" component={TodayWorkScreen} />
            <Stack.Screen name="AssignedWorkInbox" component={AssignedWorkInboxScreen} />
            <Stack.Screen name="ContinuousLiveTracking" component={ContinuousLiveTrackingScreen} />
            <Stack.Screen name="StartTracking" component={StartTrackingScreen} />
            <Stack.Screen
              name="TrackingLive"
              component={TrackingLiveScreen}
              options={{ gestureEnabled: false }}
              initialParams={resumeFmId ? { fieldMovementId: resumeFmId } : undefined}
            />
            <Stack.Screen name="MarkDestination" component={MarkDestinationScreen} />
            <Stack.Screen name="ReturnDecision" component={ReturnDecisionScreen} />
            <Stack.Screen name="SiteVisitHub" component={SiteVisitScreen} />
            <Stack.Screen name="SiteVisit" component={SiteVisitScreen} />
            <Stack.Screen name="SiteSelfieProof" component={SiteSelfieProofScreen} />
            <Stack.Screen name="SitePhotos" component={SitePhotosScreen} />
            <Stack.Screen name="SiteViewVideo" component={SiteViewVideoScreen} />
            <Stack.Screen name="Measurements" component={MeasurementsScreen} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="SiteNotes" component={SiteNotesScreen} />
            <Stack.Screen name="MaterialsEquipment" component={MaterialsEquipmentScreen} />
            <Stack.Screen name="LeadSiteVisit" component={LeadSiteVisitScreen} />
            <Stack.Screen name="SiteVisitMaterials" component={SiteVisitMaterialsScreen} />
            <Stack.Screen name="SiteVisitForm" component={SiteVisitFormScreen} />
            <Stack.Screen name="EquipmentBefore" component={EquipmentBeforeScreen} />
            <Stack.Screen name="ProjectSelection" component={ProjectSelectionScreen} />
            <Stack.Screen name="EquipmentStage" component={EquipmentStageScreen} />
            <Stack.Screen name="SiteEvidenceReview" component={SiteEvidenceReviewScreen} />
            <Stack.Screen name="WorkProgress" component={WorkProgressScreen} />
            <Stack.Screen name="PeriodicProgressPhoto" component={PeriodicProgressPhotoScreen} />
            <Stack.Screen name="FieldTrackingHistory" component={FieldTrackingHistoryScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />

          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
