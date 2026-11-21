import { existsSync } from 'node:fs';
import type { ExpoConfig, ConfigContext } from 'expo/config';

// Image assets are optional so the browser preview can build from source without binary files.
const asset = (path: string) => (existsSync(path) ? path : undefined);

// APP_ENV selects dev / staging / prod. Set it in eas.json build profiles or your shell.
const APP_ENV = (process.env.APP_ENV ?? 'dev') as 'dev' | 'staging' | 'prod';

const suffix = APP_ENV === 'prod' ? '' : `.${APP_ENV}`;
const nameSuffix = APP_ENV === 'prod' ? '' : ` (${APP_ENV})`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `HabitFlow${nameSuffix}`,
  slug: 'habitflow',
  scheme: 'habitflow',
  version: '1.0.0',
  orientation: 'portrait',
  icon: asset('./assets/icon.png'),
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    // TODO(you): replace with the bundle ID you register in App Store Connect.
    bundleIdentifier: `com.habitflow.app${suffix}`,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  web: { bundler: 'metro', output: 'single', favicon: asset('./assets/icon.png') },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: asset('./assets/splash-icon.png'),
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#F7F8FA',
        dark: { backgroundColor: '#0E1013' },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    appEnv: APP_ENV,
  },
});
