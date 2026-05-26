import { vercelPreset } from "@vercel/react-router";
import type { Config } from "@react-router/dev/config";

export default {
  presets: [vercelPreset()],
} satisfies Config;
