# Test My Account — Specifiche di Progetto

## Panoramica

App Shopify che estende l'area "Il mio account" del tema con una UI custom, esposta tramite una Theme App Extension. Il backend comunica con il tema via **App Proxy** di Shopify.

- **Nome app:** Test-my-account
- **Partner ID / Client ID:** `8795aab80f9b1cf48d0368ce283b754a`
- **Store di test:** `sonia-petriff-markets-test.myshopify.com`
- **API version:** `2026-04`

---

## Stack Tecnico

| Layer | Tecnologia |
|---|---|
| Framework backend | React Router v7 (`@react-router/fs-routes`) |
| Auth Shopify | `@shopify/shopify-app-react-router` v1.1.0 |
| Session storage | `@shopify/shopify-app-session-storage-prisma` |
| Database | SQLite via Prisma (`prisma/dev.sqlite`) |
| Frontend (tema) | Vanilla JS + Liquid (no framework) |
| Runtime | Node.js ≥ 20.19 |

---

## Architettura

```
Shopify Storefront (tema)
        │
        │  {% if customer %}
        ▼
Theme App Extension (Liquid blocks)
        │
        │  fetch('/apps/my-account?action=...')
        ▼
Shopify App Proxy  ─────────────────────────────────┐
        │                                            │
        ▼                                            │
app/routes/my-account.$.ts                     autentica la
  ├── loader  (GET)                            richiesta via
  └── action  (POST)                           authenticate.public
        │                                      .appProxy()
        ▼
app/services/*.server.ts
        │
        ▼
Shopify Admin GraphQL API (+ REST per alcune operazioni)
```

### App Proxy

- **Prefix:** `apps`
- **Subpath:** `my-account`
- **URL frontend:** `/apps/my-account?action=<action>`
- **Route backend:** `app/routes/my-account.$.ts`

Il proxy autentica le richieste senza richiedere un token esplicito — Shopify firma le richieste e `authenticate.public.appProxy()` verifica la firma.

---

## Struttura File

```
app/
├── routes/
│   ├── my-account.$.ts          # App proxy handler (loader + action)
│   ├── app.tsx                  # Layout admin con navigazione (Impostazioni, Klaviyo)
│   ├── app._index.tsx           # Pagina impostazioni admin (loyalty, metafield keys)
│   ├── app.klaviyo.tsx          # Pagina integrazione Klaviyo (mapping + sync)
│   ├── auth.$.tsx               # Auth flow
│   └── webhooks.*.tsx           # Webhook handlers
├── services/
│   ├── customer.server.ts       # Query dati cliente
│   ├── orders.server.ts         # Lista ordini + dettaglio ordine
│   ├── profile.server.ts        # Aggiornamento profilo (nome, cognome, telefono)
│   ├── address.server.ts        # Creazione indirizzo + set indirizzo principale
│   ├── consent.server.ts        # Aggiornamento consensi marketing (email + SMS)
│   ├── metafield.server.ts      # Aggiornamento preferenze marketing (metafield)
│   ├── wishlist.server.ts       # Wishlist: toggle + fetch prodotti preferiti
│   ├── settings.server.ts       # Lettura/scrittura AppSettings dal DB (per negozio)
│   └── klaviyo.server.ts        # Sync clienti Shopify → Klaviyo custom properties
└── shopify.server.ts            # Config ShopifyApp + PrismaSessionStorage

extensions/my-account/
└── blocks/
    ├── my-account.liquid        # Block principale (target: section) — My Account UI
    ├── product-tracker.liquid   # App embed (target: body) — traccia prodotti visitati
    ├── recently-viewed.liquid   # Block (target: section) — prodotti visti di recente
    ├── wishlist-toggle.liquid   # App embed (target: body) — gestisce wishlist
    └── wishlist-display.liquid  # Block (target: section) — mostra prodotti preferiti
```

---

## Backend Admin — Pagine

### `app._index.tsx` — Impostazioni generali
Route: `/app` (Home)

| Sezione | Campi |
|---|---|
| **Programma fedeltà** | `loyalty.targetOrders` (numero ordini per sbloccare il premio), `loyalty.promoCode` (codice promo da mostrare) |
| **Metafield Marketing** | `metafields.marketing.namespace`, `metafields.marketing.key`, `metafields.marketing.choices` (valori separati da virgola, es. `Man,Woman,Lifestyle`) |
| **Metafield Wishlist** | `metafields.wishlist.namespace`, `metafields.wishlist.key` |

Le impostazioni vengono salvate nel DB (`AppSettings`) e lette dal tema via `?action=settings` sull'App Proxy.

### `app.klaviyo.tsx` — Integrazione Klaviyo
Route: `/app/klaviyo`

| Sezione | Descrizione |
|---|---|
| **Connessione** | Campo `Private API Key` Klaviyo (scope minimo richiesto: **Profiles → Read + Write**) |
| **Mapping metafield** | Tabella con tutti i metafield cliente (`ownerType: CUSTOMER`): per ognuno si specifica la **Custom Property** Klaviyo (es. `shopify_data`) e il **Campo** (es. `marketing_preferences`) |
| **Sincronizzazione** | Bottone "Sincronizza ora" — fetcha i primi 50 clienti con i loro metafield e fa upsert dei profili Klaviyo via `POST /api/profile-import/` |

#### Come si configurano i mapping

Il mapping `namespace.key` → `oggetto.campo` determina dove i dati finiscono su Klaviyo:

```
custom.custom_marketing_preferences → shopify_data.marketing_preferences
custom.favourites_prod              → shopify_data.wishlist
```

Su Klaviyo il profilo cliente avrà (sotto Custom Properties):
```json
{
  "shopify_data": {
    "marketing_preferences": "[\"Uomo\",\"Donna\"]",
    "wishlist": "[\"maglietta\",\"scarpe\"]"
  }
}
```

#### Klaviyo API usata

- **Endpoint:** `POST https://a.klaviyo.com/api/profile-import/`
- **Revision:** `2024-10-15`
- **Auth:** `Authorization: Klaviyo-API-Key pk_...`
- **Effetto:** crea o aggiorna il profilo identificato per email, scrivendo le custom properties indicate

#### Note multi-store
- L'API key Klaviyo è salvata per negozio (`AppSettings.klaviyo.apiKey`) — ogni store ha la propria
- Se l'app è installata su uno store di test, il sync manda dati di test in Klaviyo → usare un account Klaviyo separato per i test
- Le custom properties non triggherano flow/automation Klaviyo automaticamente

---

## API Actions

### GET (loader) — `?action=<action>&customerId=<id>`

| Action | Servizio | Descrizione |
|---|---|---|
| `customer` | `customer.server.ts` | Dati cliente completi (profilo, indirizzi, consensi, metafield) |
| `orders` | `orders.server.ts` | Lista ultimi 10 ordini |
| `order` | `orders.server.ts` | Dettaglio singolo ordine (`&orderId=<gid>`) |
| `wishlist` | `wishlist.server.ts` | Prodotti nella wishlist (con immagine, prezzo, URL) |

### POST (action) — `?action=<action>` + body JSON

| Action | Servizio | Body |
|---|---|---|
| `update-profile` | `profile.server.ts` | `{ customerId, firstName, lastName, phone }` |
| `create-address` | `address.server.ts` | `{ customerId, address: { address1, city, zip, country, ... } }` |
| `set-default-address` | `address.server.ts` | `{ customerId, addressId }` |
| `update-metafield` | `metafield.server.ts` | `{ customerId, values: ["Man","Woman","Lifestyle"] }` |
| `update-consent` | `consent.server.ts` | `{ customerId, emailSubscribed, smsSubscribed, phone }` |
| `toggle-wishlist` | `wishlist.server.ts` | `{ customerId, handle }` |

---

## Theme Extension Blocks

### `my-account.liquid` — Block principale
- **Target:** `section` (aggiunto manualmente nel tema)
- **Attivazione:** solo se `{% if customer %}` (utente loggato)
- **Tab UI:**
  - **Il mio profilo** — form nome/cognome/telefono (email read-only), progress bar loyalty circolare (ordini verso quota 10 → codice `LOYAL10`)
  - **Indirizzi** — lista indirizzi con bottone "Imposta come principale", form aggiungi indirizzo
  - **Marketing** — checkbox consenso email + SMS, checkbox preferenze (Man/Woman/Lifestyle via metafield)
  - **Ordini** — lista ordini con stato, click → dettaglio con line items, tracking, indirizzo spedizione

### `product-tracker.liquid` — App Embed tracker
- **Target:** `body` (App Embeds nel customizer)
- **Checkbox:** "Abilita tracking prodotti visitati"
- **Funzionamento:** su ogni pagina prodotto (`{% if product %}`), salva in `localStorage['ma_rv']` un array di oggetti `{ id, title, url, image, price }` (max 20)

### `recently-viewed.liquid` — Block prodotti visti
- **Target:** `section`
- **Funzionamento:** legge `localStorage['ma_rv']`, mostra max 6 prodotti in griglia, solo se loggato
- **Settings:** nessuno

### `wishlist-toggle.liquid` — App Embed wishlist
- **Target:** `body` (App Embeds nel customizer)
- **Funzionamento:** intercetta click su qualsiasi elemento `.wishlist[data-wish="handle"]` nel tema, chiama `toggle-wishlist` via app proxy, aggiorna la classe `.wishlisted` sul bottone
- **Stato iniziale:** letto via Liquid da `customer.metafields.custom.favourites_prod.value` (richiede storefront access sul metafield, vedi note)

### `wishlist-display.liquid` — Block prodotti preferiti
- **Target:** `section`
- **Funzionamento:** su mount chiama `?action=wishlist` via fetch, renderizza griglia prodotti
- **Settings:** titolo sezione, numero massimo prodotti (2–12, step 2)

---

## Metafield Shopify Usati

| Namespace | Key | Tipo | Owner | Usato da |
|---|---|---|---|---|
| `custom` | `custom_marketing_preferences` | `list.single_line_text_field` | Customer | Tab Marketing — preferenze (Man/Woman/Lifestyle) |
| `custom` | `favourites_prod` | `list.product_reference` | Customer | Wishlist toggle + display |

### Note storefront access
Per far funzionare lo stato iniziale dei bottoni wishlist senza chiamata API aggiuntiva, il metafield `custom.favourites_prod` deve avere storefront access abilitato:
> Shopify Admin → Impostazioni → Metafield personalizzati → Clienti → `favourites_prod` → abilita "Esponi all'API Storefront"

---

## Database — AppSettings

Modello Prisma `AppSettings` (uno per negozio):

```prisma
model AppSettings {
  id        String   @id @default(cuid())
  shop      String   @unique
  settings  String   # JSON blob con tutta la configurazione
  updatedAt DateTime @updatedAt
}
```

Struttura JSON salvata:
```json
{
  "loyalty": {
    "targetOrders": 10,
    "promoCode": "LOYAL10"
  },
  "metafields": {
    "marketing": { "namespace": "custom", "key": "custom_marketing_preferences", "choices": "Man,Woman,Lifestyle" },
    "wishlist":  { "namespace": "custom", "key": "favourites_prod" }
  },
  "klaviyo": {
    "apiKey": "pk_...",
    "mappings": {
      "custom.custom_marketing_preferences": "shopify_data.marketing_preferences",
      "custom.favourites_prod": "shopify_data.wishlist"
    }
  }
}
```

Per visualizzare/modificare i dati in sviluppo:
```bash
npx prisma studio
# apre http://localhost:5555
```

---

## Scopes OAuth

```
write_metaobject_definitions
write_metaobjects
write_products
read_customers
write_customers
read_orders
```

---

## Mutation GraphQL Usate

| Mutation | Usata per |
|---|---|
| `customerUpdate` | Aggiornamento profilo (nome, cognome, telefono), preferenze marketing |
| `customerEmailMarketingConsentUpdate` | Consenso email marketing |
| `customerSmsMarketingConsentUpdate` | Consenso SMS marketing |
| `customerAddressCreate` | Creazione nuovo indirizzo |
| `metafieldsSet` | Aggiornamento wishlist (`list.product_reference`) |

### Nota REST API
L'impostazione dell'indirizzo principale usa la **REST API** (non GraphQL) perché `customerDefaultAddressUpdate` non esiste nell'API 2026-04 e `CustomerInput` non accetta `defaultAddressId`:
```
PUT /admin/api/2024-10/customers/{id}/addresses/{address_id}/default.json
```

---

## Come Avviare in Sviluppo

```bash
npm run dev
# oppure
shopify app dev
```

Il comando:
1. Avvia il server React Router in locale
2. Crea un tunnel Cloudflare temporaneo (`*.trycloudflare.com`)
3. Aggiorna automaticamente i redirect URL nell'app

**Attenzione:** l'URL del tunnel cambia ad ogni riavvio. Se l'URL cambia, serve reinstallare l'app sul negozio via il link `redirect_from_cli` mostrato nel terminale.

---

## Deploy

```bash
shopify app deploy
```

Per un URL stabile in produzione, deployare il backend su **Railway** o **Render** e aggiornare `application_url` e `[app_proxy].url` nel `shopify.app.toml`.

---

## Wishlist — Bug Known

Il toggle wishlist restituisce l'errore `"Value of list has a maximum size of 0"` usando `customerUpdate` con metafields di tipo `list.product_reference`. La fix in corso è usare `metafieldsSet` invece di `customerUpdate`.

---

## Roadmap / Features Future

- [ ] Fix wishlist (`metafieldsSet`)
- [ ] Progress bar ordini → Klaviyo sync quando si raggiunge quota 10
- [ ] Tab ordini: bottone "Riordina" (Storefront API `cartCreate`)
- [ ] Tier membership (Bronze/Silver/Gold) basato su totale speso
- [ ] Gestione resi (form request + tag ordine)
- [ ] Layer CDP: Shopify webhook → DB → Klaviyo custom properties con regole configurabili
- [ ] Klaviyo sync paginato (attualmente solo primi 50 clienti)
- [ ] Klaviyo identify() real-time dal tema (aggiornamento preferenze marketing senza sync manuale)
- [ ] GDPR webhooks obbligatori per App Store (`customers/data_request`, `customers/redact`, `shop/redact`)
- [ ] Migrazione DB da SQLite a PostgreSQL per produzione
