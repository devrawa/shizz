import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "ai.shizz.agent",
  appName: "shizz ai agent",
  webDir: "dist",
  server: { androidScheme: "https", hostname: "localhost" },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: "#0c100e",
  },
};
export default config;
