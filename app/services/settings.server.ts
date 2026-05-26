import prisma from "../db.server";

export interface AppSettings {
  loyalty: {
    enabled: boolean;
    targetOrders: number;
    promoCode: string;
  };
  metafields: {
    marketing: {
      namespace: string;
      key: string;
      choices: string;
    };
    wishlist: {
      namespace: string;
      key: string;
      enabled: boolean;
    };
    birthdate: {
      namespace: string;
      key: string;
    };
  };
  klaviyo: {
    apiKey: string;
    mappings: Record<string, string>; // "namespace.key" -> "klaviyo_property_name"
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  loyalty: {
    enabled: false,
    targetOrders: 10,
    promoCode: "LOYAL10",
  },
  metafields: {
    marketing: {
      namespace: "custom",
      key: "custom_marketing_preferences",
      choices: "Man,Woman,Lifestyle",
    },
    wishlist: {
      namespace: "custom",
      key: "favourites_prod",
      enabled: false,
    },
    birthdate: {
      namespace: "custom",
      key: "birth_date",
    },
  },
  klaviyo: {
    apiKey: "",
    mappings: {},
  },
};

function deepMerge<T>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key in override) {
    const val = override[key];
    if (val !== undefined && val !== null) {
      if (typeof val === "object" && !Array.isArray(val)) {
        result[key] = deepMerge(result[key] as any, val as any);
      } else {
        result[key] = val as any;
      }
    }
  }
  return result;
}

export async function getSettings(shop: string): Promise<AppSettings> {
  const record = await prisma.appSettings.findUnique({ where: { shop } });
  if (!record) return DEFAULT_SETTINGS;
  try {
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(record.settings));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(
  shop: string,
  partial: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getSettings(shop);
  const merged = deepMerge(current, partial);
  await prisma.appSettings.upsert({
    where: { shop },
    create: { shop, settings: JSON.stringify(merged) },
    update: { settings: JSON.stringify(merged) },
  });
  return merged;
}
