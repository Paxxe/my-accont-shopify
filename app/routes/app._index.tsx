import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getSettings, saveSettings, type AppSettings } from "../services/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const body = await request.json();
  const saved = await saveSettings(session.shop, body);
  return { ok: true, settings: saved };
};

export default function Index() {
  const { settings: initial } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [settings, setSettings] = useState<AppSettings>(initial);
  const isSaving = fetcher.state !== "idle";

  const set = (path: string[], value: string | number | boolean) => {
    setSettings((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur: any = next;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = () => {
    fetcher.submit(settings as any, {
      method: "POST",
      encType: "application/json",
    });
    shopify.toast.show("Impostazioni salvate");
  };

  const checkbox = (label: string, path: string[], helpText?: string) => {
    const value = path.reduce((obj: any, k) => obj?.[k], settings);
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => set(path, e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
        </label>
        {helpText && <p style={{ fontSize: 12, color: "#6d7175", margin: "4px 0 0 24px" }}>{helpText}</p>}
      </div>
    );
  };

  const field = (
    label: string,
    path: string[],
    type: "text" | "number" = "text",
    helpText?: string
  ) => {
    const value = path.reduce((obj: any, k) => obj?.[k], settings);
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
          {label}
        </label>
        {helpText && (
          <p style={{ fontSize: 12, color: "#6d7175", margin: "0 0 6px" }}>{helpText}</p>
        )}
        <input
          type={type}
          value={String(value)}
          min={type === "number" ? 1 : undefined}
          onChange={(e) =>
            set(path, type === "number" ? parseInt(e.target.value, 10) || 1 : e.target.value)
          }
          style={{
            width: type === "number" ? 100 : "100%",
            maxWidth: 400,
            padding: "8px 10px",
            border: "1px solid #c9cccf",
            borderRadius: 6,
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  };

  return (
    <s-page heading="Impostazioni My Account">
      <s-button
        slot="primary-action"
        onClick={handleSave}
        {...(isSaving ? { loading: true } : {})}
      >
        Salva impostazioni
      </s-button>

      <s-section heading="Programma fedeltà">
        <s-paragraph>
          Configura la soglia di ordini e il codice promo che viene mostrato all'utente
          quando raggiunge l'obiettivo.
        </s-paragraph>
        <div style={{ marginTop: 16 }}>
          {checkbox(
            "Abilita Programma Fedeltà",
            ["loyalty", "enabled"],
            "Se attivo, mostra la progress bar fedeltà nel profilo utente."
          )}
          {field(
            "Numero ordini per sbloccare il premio",
            ["loyalty", "targetOrders"],
            "number",
            "L'utente vedrà la progress bar circolare avanzare verso questo obiettivo."
          )}
          {field(
            "Codice promo da mostrare",
            ["loyalty", "promoCode"],
            "text",
            "Il codice viene mostrato nella scheda profilo quando l'utente raggiunge l'obiettivo."
          )}
        </div>
      </s-section>

      <s-section heading="Metafield — Preferenze marketing">
        <s-paragraph>
          Metafield del cliente dove vengono salvate le preferenze marketing (es. Man, Woman, Lifestyle).
          Deve essere di tipo list.single_line_text_field.
        </s-paragraph>
        <div style={{ marginTop: 16 }}>
          {field("Namespace", ["metafields", "marketing", "namespace"])}
          {field("Key", ["metafields", "marketing", "key"])}
          {field(
            "Scelte disponibili (separate da virgola)",
            ["metafields", "marketing", "choices"],
            "text",
            "Es: Man,Woman,Lifestyle — verranno mostrate come checkbox nella tab Marketing."
          )}
        </div>
      </s-section>

      <s-section heading="Metafield — Data di nascita">
        <s-paragraph>
          Metafield del cliente dove viene salvata la data di nascita. Deve essere di tipo <strong>date</strong>.
        </s-paragraph>
        <div style={{ marginTop: 16 }}>
          {field("Namespace", ["metafields", "birthdate", "namespace"])}
          {field("Key", ["metafields", "birthdate", "key"])}
        </div>
      </s-section>

      <s-section heading="Metafield — Wishlist">
        <s-paragraph>
          Metafield del cliente dove vengono salvati i prodotti preferiti.
          Deve essere di tipo list.product_reference.
        </s-paragraph>
        <div style={{ marginTop: 16 }}>
          {checkbox(
            "Abilita Wishlist",
            ["metafields", "wishlist", "enabled"],
            "Se attivo, mostra il tab Wishlist nel widget My Account e abilita il salvataggio dei prodotti preferiti."
          )}
          {field("Namespace", ["metafields", "wishlist", "namespace"])}
          {field("Key", ["metafields", "wishlist", "key"])}
        </div>
      </s-section>

      <s-section slot="aside" heading="Come funziona">
        <s-paragraph>
          Le impostazioni vengono salvate nel database dell'app e applicate in tempo reale
          al tema tramite l'App Proxy.
        </s-paragraph>
        <s-paragraph>
          La progress bar del profilo utente si aggiorna automaticamente con il nuovo
          obiettivo e codice promo senza modificare il tema.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
