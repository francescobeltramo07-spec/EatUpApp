import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  plugins: [...(config.plugins ?? []), "expo-image", "expo-status-bar"],
  extra: {
    ...config.extra,
    eatUpApiOrigin:
      process.env.EATUP_API_ORIGIN ?? config.extra?.eatUpApiOrigin ?? "",
  },
});
