import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getSettings, saveSettings } from "../services/settings.server";
import { syncCustomersToKlaviyo } from "../services/klaviyo.server";

const METAFIELD_DEFINITIONS_QUERY = `#graphql
  query GetCustomerMetafieldDefinitions {
    metafieldDefinitions(ownerType: CUSTOMER, first: 50) {
      nodes {
        id
        name
        namespace
        key
        type { name }
        description
      }
    }
  }
`;

interface MetafieldDefinition {
  id: string;
  name: string;
  namespace: string;
  key: string;
  type: { name: string };
  description: string | null;
}

interface KlaviyoMapping {
  object: string;
  field: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);

  const res = await admin.graphql(METAFIELD_DEFINITIONS_QUERY);
  const json = await res.json();
  const definitions: MetafieldDefinition[] =
    json.data?.metafieldDefinitions?.nodes ?? [];

  return { definitions, klaviyo: settings.klaviyo };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const body = await request.json();

  if (body._action === "sync") {
    const settings = await getSettings(session.shop);
    if (!settings.klaviyo.apiKey) {
      return { ok: false, error: "Klaviyo API key non configurata" };
    }
    const result = await syncCustomersToKlaviyo(
      admin,
      settings.klaviyo.apiKey,
      settings.klaviyo.mappings
    );
    return { ok: true, _action: "sync", result };
  }

  // default: save settings
  const flatMappings: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.mappings as Record<string, string>)) {
    if (v) flatMappings[k] = v;
  }
  const saved = await saveSettings(session.shop, {
    klaviyo: { apiKey: body.apiKey, mappings: flatMappings },
  });
  return { ok: true, _action: "save", klaviyo: saved.klaviyo };
};

export default function KlaviyoPage() {
  const { definitions, klaviyo: initial } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [mappings, setMappings] = useState<Record<string, KlaviyoMapping>>(
    Object.fromEntries(
      Object.entries(initial.mappings).map(([k, v]) => {
        const dot = v.indexOf(".");
        return [k, { object: dot === -1 ? v : v.slice(0, dot), field: dot === -1 ? "" : v.slice(dot + 1) }];
      })
    )
  );

  const isSaving = fetcher.state !== "idle" && (fetcher.json as any)?._action !== "sync";
  const isSyncing = fetcher.state !== "idle" && (fetcher.json as any)?._action === "sync";
  const syncResult = fetcher.state === "idle" && (fetcher.data as any)?._action === "sync"
    ? (fetcher.data as any).result
    : null;
  const syncError = fetcher.state === "idle" && (fetcher.data as any)?._action === "sync" && !(fetcher.data as any)?.ok
    ? (fetcher.data as any).error
    : null;

  const setMapping = (metaKey: string, part: "object" | "field", value: string) => {
    setMappings((prev) => ({
      ...prev,
      [metaKey]: { ...(prev[metaKey] ?? { object: "", field: "" }), [part]: value },
    }));
  };

  const handleSave = () => {
    const flatMappings: Record<string, string> = {};
    for (const [k, v] of Object.entries(mappings)) {
      if (v.object || v.field) flatMappings[k] = `${v.object}.${v.field}`;
    }
    fetcher.submit({ _action: "save", apiKey, mappings: flatMappings } as any, {
      method: "POST",
      encType: "application/json",
    });
    shopify.toast.show("Impostazioni Klaviyo salvate");
  };

  const handleSync = () => {
    fetcher.submit({ _action: "sync" } as any, {
      method: "POST",
      encType: "application/json",
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #c9cccf",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "monospace",
    boxSizing: "border-box",
  };

  return (
    <s-page heading="Klaviyo — Mapping metafield cliente">
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(isSaving ? { loading: true } : {})}
      >
        Salva
      </s-button>

      <s-section heading="Connessione Klaviyo">
        <s-paragraph>
          Inserisci la tua Klaviyo Private API Key. La trovi in Klaviyo → Account → Settings → API Keys.
        </s-paragraph>
        <div style={{ marginTop: 16, maxWidth: 500 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            Private API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxx"
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #c9cccf",
              borderRadius: 6,
              fontSize: 14,
              boxSizing: "border-box",
              fontFamily: "monospace",
            }}
          />
        </div>
      </s-section>

      <s-section heading="Mapping metafield cliente → Custom proprieties Klaviyo">
        <s-paragraph>
          Per ogni metafield cliente, specifica il <strong>Custom proprieties</strong> e il{" "}
          <strong>campo</strong> Klaviyo corrispondente. Lascia vuoto per non mappare.
        </s-paragraph>

        {definitions.length === 0 ? (
          <p style={{ color: "#6d7175", fontSize: 14, marginTop: 16 }}>
            Nessun metafield cliente trovato nel negozio.
          </p>
        ) : (
          <div style={{ marginTop: 16, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e1e3e5", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "#202223", minWidth: 160 }}>
                    Metafield cliente
                  </th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "#202223", minWidth: 100 }}>
                    Tipo
                  </th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "#202223", minWidth: 180 }}>
                    Custom proprieties Klaviyo
                  </th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "#202223", minWidth: 160 }}>
                    Campo nell'Object
                  </th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => {
                  const metaKey = `${def.namespace}.${def.key}`;
                  const m = mappings[metaKey] ?? { object: "", field: "" };
                  return (
                    <tr key={def.id} style={{ borderBottom: "1px solid #e1e3e5" }}>
                      <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                        <span style={{ fontWeight: 500 }}>{def.name}</span>
                        <div style={{ marginTop: 2 }}>
                          <code style={{ fontSize: 11, background: "#f6f6f7", padding: "2px 6px", borderRadius: 4 }}>
                            {metaKey}
                          </code>
                        </div>
                        {def.description && (
                          <div style={{ fontSize: 11, color: "#6d7175", marginTop: 2 }}>
                            {def.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "middle", color: "#6d7175", fontSize: 12 }}>
                        {def.type.name}
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                        <input
                          type="text"
                          value={m.object}
                          onChange={(e) => setMapping(metaKey, "object", e.target.value)}
                          placeholder="shopify_customer"
                          style={inputStyle}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                        <input
                          type="text"
                          value={m.field}
                          onChange={(e) => setMapping(metaKey, "field", e.target.value)}
                          placeholder="nome_campo"
                          style={inputStyle}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </s-section>

      <s-section heading="Sincronizzazione">
        <s-paragraph>
          Sincronizza i metafield dei clienti su Klaviyo usando i mapping configurati sopra.
          La prima esecuzione processa i primi 50 clienti.
        </s-paragraph>
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <s-button
            onClick={handleSync}
            {...(isSyncing ? { loading: true } : {})}
            {...(!apiKey ? { disabled: true } : {})}
          >
            {isSyncing ? "Sincronizzazione in corso..." : "Sincronizza ora"}
          </s-button>

          {!apiKey && (
            <span style={{ fontSize: 13, color: "#6d7175" }}>
              Inserisci l'API key per abilitare la sync
            </span>
          )}

          {syncResult && (
            <div style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 6,
              background: syncResult.errors > 0 ? "#fff3cd" : "#d4edda",
              border: `1px solid ${syncResult.errors > 0 ? "#ffc107" : "#28a745"}`,
              color: "#202223",
            }}>
              Sincronizzati: <strong>{syncResult.synced}</strong> —{" "}
              Saltati: <strong>{syncResult.skipped}</strong>
              {syncResult.errors > 0 && (
                <> — Errori: <strong style={{ color: "#d82c0d" }}>{syncResult.errors}</strong></>
              )}
            </div>
          )}

          {syncError && (
            <div style={{
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 6,
              background: "#ffd2d2",
              border: "1px solid #d82c0d",
              color: "#d82c0d",
            }}>
              {syncError}
            </div>
          )}
        </div>
      </s-section>

      <s-section slot="aside" heading="Come funziona">
        <s-paragraph>
          I <strong>Custom Objects</strong> in Klaviyo sono strutture dati collegate
          ai profili. Ogni Object ha un nome (es. <code>shopify_customer</code>) e
          dei campi personalizzati.
        </s-paragraph>
        <s-paragraph>
          Durante la sync, ogni cliente viene identificato per email e i suoi
          metafield vengono scritti come proprietà annidate nel profilo Klaviyo.
        </s-paragraph>
        <s-paragraph>
          Crea prima la definizione dell'Object in Klaviyo → Data → Custom Objects,
          poi configura il mapping qui.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
