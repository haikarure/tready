import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Tready', slug: 'tready', version: '0.1.1',
  icon: './assets/icon.png',
  orientation: 'portrait', userInterfaceStyle: 'dark',
  android: { package: 'xyz.tready.app', versionCode: 4, permissions: ['USE_BIOMETRIC'], adaptiveIcon: { foregroundImage:'./assets/foreground.png',backgroundColor:'#0B111A' } },
  plugins: ['expo-secure-store', 'expo-sqlite', './plugins/withPreviewSigning.cjs'],
  extra: { rpId: process.env.TREADY_RP_ID ?? '', origin: process.env.TREADY_ORIGIN ?? '', ...(process.env.TREADY_ENROLLMENT_POLICY_JSON ? { enrollmentPolicy: JSON.parse(process.env.TREADY_ENROLLMENT_POLICY_JSON) } : {}) },
};
export default config;
