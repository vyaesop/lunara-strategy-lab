import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lunara.strategylab",
  appName: "Lunara Strategy Lab",
  webDir: "dist",
  backgroundColor: "#0b0f14",
  android: {
    backgroundColor: "#0b0f14",
    allowMixedContent: false,
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    Keyboard: { resize: "native", resizeOnFullScreen: true },
    SplashScreen: { launchAutoHide: true, backgroundColor: "#0b0f14", showSpinner: false },
    StatusBar: { style: "DARK", backgroundColor: "#0b0f14", overlaysWebView: false },
  },
};

export default config;
