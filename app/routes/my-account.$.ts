import { authenticate } from "../shopify.server";
import { getCustomerData } from "../services/customer.server";
import { getCustomerOrders, getOrderDetail } from "../services/orders.server";
import { createCustomerAddress, setDefaultAddress, deleteCustomerAddress } from "../services/address.server";
import { updateMarketingPreferences } from "../services/metafield.server";
import { getWishlistProducts, toggleWishlistItem } from "../services/wishlist.server";
import { updateMarketingConsent } from "../services/consent.server";
import { updateCustomerProfile } from "../services/profile.server";
import { getSettings } from "../services/settings.server";
import { syncSingleMetafieldToKlaviyo } from "../services/klaviyo.server";

function normalizeCustomerId(id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/Customer/${id}`;
}

export async function loader({ request }: { request: Request }) {
  console.log("[PROXY DEBUG] URL:", request.url);
  console.log("[PROXY DEBUG] Headers:", JSON.stringify(Object.fromEntries(request.headers.entries())));
  const { admin, session } = await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const customerIdRaw = url.searchParams.get("customerId");

  if (!admin) {
    return Response.json({ ok: false, error: "Admin client unavailable" }, { status: 401 });
  }

  if (action === "settings") {
    const settings = await getSettings(session?.shop ?? "");
    return Response.json({ ok: true, settings });
  }

  if (!customerIdRaw) {
    return Response.json({ ok: false, error: "Missing customerId" }, { status: 400 });
  }

  const customerId = normalizeCustomerId(customerIdRaw);

  try {
    switch (action) {
      case "customer": {
        const settings = await getSettings(session?.shop ?? "");
        const bd = settings.metafields?.birthdate;
        const customer = await getCustomerData(admin, customerId, bd?.namespace, bd?.key);
        return Response.json({ ok: true, action: "customer", customer });
      }
      case "orders": {
        const orders = await getCustomerOrders(admin, customerId);
        return Response.json({ ok: true, action: "orders", orders });
      }
      case "order": {
        const orderId = url.searchParams.get("orderId");
        if (!orderId) return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });
        const order = await getOrderDetail(admin, orderId);
        return Response.json({ ok: true, action: "order", order });
      }
      case "wishlist": {
        const products = await getWishlistProducts(admin, customerId);
        return Response.json({ ok: true, products });
      }
      default:
        return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[APP PROXY] loader error", {
      action,
      customerIdRaw,
      shop: session?.shop,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function action({ request }: { request: Request }) {
  const { admin, session } = await authenticate.public.appProxy(request);

  if (!admin) {
    return Response.json({ ok: false, error: "Admin client unavailable" }, { status: 401 });
  }

  const url = new URL(request.url);
  const actionType = url.searchParams.get("action");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const customerIdRaw = body.customerId;
  if (!customerIdRaw) {
    return Response.json({ ok: false, error: "Missing customerId" }, { status: 400 });
  }

  const customerId = normalizeCustomerId(customerIdRaw);

  try {
    switch (actionType) {
      case "update-profile": {
        const settings = await getSettings(session?.shop ?? "");
        const bd = settings.metafields?.birthdate;
        const customer = await updateCustomerProfile(admin, customerId, {
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone || undefined,
          birthDate: body.birthDate || undefined,
          bdNS: bd?.namespace,
          bdKey: bd?.key,
        });
        return Response.json({ ok: true, customer });
      }
      case "create-address": {
        const address = await createCustomerAddress(admin, customerId, body.address);
        return Response.json({ ok: true, address });
      }
      case "set-default-address": {
        await setDefaultAddress(session as { shop: string; accessToken: string }, customerId, body.addressId);
        return Response.json({ ok: true });
      }
      case "delete-address": {
        await deleteCustomerAddress(session as { shop: string; accessToken: string }, customerId, body.addressId);
        return Response.json({ ok: true });
      }
      case "update-metafield": {
        const metafield = await updateMarketingPreferences(admin, customerId, body.values ?? []);
        const settings = await getSettings(session?.shop ?? "");
        const { apiKey, mappings } = settings.klaviyo ?? {};
        if (apiKey && body.email) {
          const mf = settings.metafields?.marketing;
          const metafieldKey = mf ? `${mf.namespace}.${mf.key}` : "custom.custom_marketing_preferences";
          syncSingleMetafieldToKlaviyo(apiKey, mappings ?? {}, body.email, metafieldKey, JSON.stringify(body.values ?? [])).catch(
            (e) => console.warn("[Klaviyo] sync failed:", e.message)
          );
        }
        return Response.json({ ok: true, metafield });
      }
      case "toggle-wishlist": {
        const result = await toggleWishlistItem(admin, customerId, body.handle);
        return Response.json({ ok: true, ...result });
      }
      case "update-consent": {
        const customer = await updateMarketingConsent(
          admin,
          customerId,
          body.emailSubscribed ?? false,
          body.smsSubscribed ?? false,
          body.phone ?? null
        );
        return Response.json({ ok: true, customer });
      }
      default:
        return Response.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[APP PROXY] action error", {
      actionType,
      customerIdRaw,
      shop: session?.shop,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
