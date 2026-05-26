const KLAVIYO_API_BASE = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-10-15";

function headers(apiKey: string) {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: KLAVIYO_REVISION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// Upserts a Klaviyo profile identified by email, setting nested custom properties.
// Properties are structured as { objectName: { fieldName: value } }
// so they appear as custom object fields on the profile in Klaviyo.
export async function upsertKlaviyoProfile(
  apiKey: string,
  email: string,
  properties: Record<string, Record<string, string>>
): Promise<void> {
  const res = await fetch(`${KLAVIYO_API_BASE}/profile-import/`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      data: {
        type: "profile",
        attributes: { email, properties },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Klaviyo ${res.status}: ${text}`);
  }
}

// Syncs a single metafield update to Klaviyo using the configured mappings.
// Called immediately after the customer saves preferences on the storefront.
export async function syncSingleMetafieldToKlaviyo(
  apiKey: string,
  mappings: Record<string, string>,
  email: string,
  metafieldKey: string,
  value: string
): Promise<void> {
  const mapping = mappings[metafieldKey];
  if (!mapping) return;

  const dotIndex = mapping.indexOf(".");
  if (dotIndex === -1) return;

  const objectName = mapping.slice(0, dotIndex);
  const fieldName = mapping.slice(dotIndex + 1);
  if (!objectName || !fieldName) return;

  const properties: Record<string, Record<string, string>> = {
    [objectName]: { [fieldName]: value },
  };

  await upsertKlaviyoProfile(apiKey, email, properties);
}

const CUSTOMERS_QUERY = `#graphql
  query GetCustomersForSync($cursor: String) {
    customers(first: 50, after: $cursor) {
      nodes {
        id
        email
        metafields(first: 50) {
          nodes {
            namespace
            key
            value
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

// Fetches up to 50 customers with their metafields and syncs them to Klaviyo
// using the provided mapping: "namespace.key" -> "klaviyo_object.field_name"
export async function syncCustomersToKlaviyo(
  admin: any,
  klaviyoApiKey: string,
  mappings: Record<string, string>
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };

  const mappedKeys = Object.keys(mappings);
  if (mappedKeys.length === 0) return result;

  const res = await admin.graphql(CUSTOMERS_QUERY, { variables: {} });
  const json = await res.json();
  const customers: Array<{
    id: string;
    email: string;
    metafields: { nodes: Array<{ namespace: string; key: string; value: string }> };
  }> = json.data?.customers?.nodes ?? [];

  for (const customer of customers) {
    if (!customer.email) {
      result.skipped++;
      continue;
    }

    // Build nested properties structure: { objectName: { fieldName: value } }
    const properties: Record<string, Record<string, string>> = {};
    let hasData = false;

    for (const mf of customer.metafields.nodes) {
      const metaKey = `${mf.namespace}.${mf.key}`;
      const mapping = mappings[metaKey];
      if (!mapping) continue;

      const dotIndex = mapping.indexOf(".");
      if (dotIndex === -1) continue;

      const objectName = mapping.slice(0, dotIndex);
      const fieldName = mapping.slice(dotIndex + 1);
      if (!objectName || !fieldName) continue;

      if (!properties[objectName]) properties[objectName] = {};
      properties[objectName][fieldName] = mf.value;
      hasData = true;
    }

    if (!hasData) {
      result.skipped++;
      continue;
    }

    try {
      await upsertKlaviyoProfile(klaviyoApiKey, customer.email, properties);
      result.synced++;
    } catch {
      result.errors++;
    }
  }

  return result;
}
