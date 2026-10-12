import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Tready', slug: 'tready', version: '0.1.0',
  icon: './assets/icon.png',
  orientation: 'portrait', userInterfaceStyle: 'dark',
  android: { package: 'xyz.tready.app', versionCode: 2, permissions: ['USE_BIOMETRIC'], adaptiveIcon: { foregroundImage:'./assets/foreground.png',backgroundColor:'#0B111A' } },
  plugins: ['expo-secure-store', 'expo-sqlite', './plugins/withPreviewSigning.cjs'],
  extra: { rpId: process.env.TREADY_RP_ID ?? '', origin: process.env.TREADY_ORIGIN ?? '', enrollmentPolicy: process.env.TREADY_ENROLLMENT_POLICY_JSON ? JSON.parse(process.env.TREADY_ENROLLMENT_POLICY_JSON) : null },
};
export default config;
