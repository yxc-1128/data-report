import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fan.zoe.reporter',
  appName: '收支报表',
  webDir: 'www',

  server: {
    url: 'https://reporter.zoe.fan:16666',
    cleartext: false,
    allowNavigation: ['reporter.zoe.fan']
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },

  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0f1923",
      showSpinner: false
    }
  }
};

export default config;
