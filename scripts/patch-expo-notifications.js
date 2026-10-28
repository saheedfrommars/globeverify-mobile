const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'TopicSubscriptionModule.android.js'
);

const patchedContent = `import { requireOptionalNativeModule, requireNativeModule } from 'expo';

let moduleImpl = null;
try {
  if (typeof requireOptionalNativeModule === 'function') {
    moduleImpl = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
  } else if (typeof requireNativeModule === 'function') {
    moduleImpl = requireNativeModule('ExpoTopicSubscriptionModule');
  }
} catch (e) {
  // Graceful fallback for Expo Go where ExpoTopicSubscriptionModule is not registered
}

if (!moduleImpl) {
  moduleImpl = {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(null),
    unsubscribeFromTopicAsync: () => Promise.resolve(null),
  };
}

export default moduleImpl;
//# sourceMappingURL=TopicSubscriptionModule.android.js.map
`;

try {
  if (fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, patchedContent, 'utf8');
    console.log('[patch-expo-notifications] Successfully applied Expo Go fallback to TopicSubscriptionModule.android.js');
  }
} catch (err) {
  console.warn('[patch-expo-notifications] Notice: Could not patch TopicSubscriptionModule:', err.message);
}
