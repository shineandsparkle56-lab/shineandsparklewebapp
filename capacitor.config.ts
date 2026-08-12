import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.shineandsparkle.app',
  appName: 'Shine and Sparkle',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Remove this block after development — forces live reload from your Vercel URL
    // url: 'https://shineandsparkle.in',
    // cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true during dev if needed
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
};

export default config;
