/**
 * Demo mode: a browser-only preview build (EXPO_PUBLIC_DEMO=1). It skips real auth and cloud sync
 * and fills the local database with sample habits. Never enable it in an iOS build.
 */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
export const DEMO_USER_ID = 'demo-user';
