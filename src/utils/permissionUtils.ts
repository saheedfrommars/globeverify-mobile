import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Request runtime microphone permission for Android WebRTC voice calls.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (alreadyGranted) {
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message:
            'GlobeVerify requires microphone access to place and receive telephone voice calls on your leased numbers.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[Permissions] Failed to request microphone permission:', err);
      return false;
    }
  }
  return true;
}
