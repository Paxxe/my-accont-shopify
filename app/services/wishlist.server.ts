const GET_WISHLIST_QUERY = `#graphql
  query GetCustomerWishlist($customerId: ID!) {
    customer(id: $customerId) {
      metafield(namespace: "custom", key: "favourites_prod") {
        id
        value
      }
    }
  }
`;

const GET_PRODUCTS_DATA_QUERY = `#graphql
  query GetProductsData($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        handle
        title
        onlineStoreUrl
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

const GET_PRODUCT_GID_QUERY = `#graphql
  query GetProductGid($query: String!) {
    products(first: 1, query: $query) {
      nodes { id }
    }
  }
`;

const UPDATE_WISHLIST_MUTATION = `#graphql
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

async function getWishlistState(
  admin: any,
  customerId: string
): Promise<{ id: string | null; gids: string[] }> {
  const response = await admin.graphql(GET_WISHLIST_QUERY, { variables: { customerId } });
  const json = await response.json();
  const metafield = json?.data?.customer?.metafield;
  if (!metafield?.value) return { id: metafield?.id ?? null, gids: [] };
  try {
    return { id: metafield.id, gids: JSON.parse(metafield.value) };
  } catch {
    return { id: metafield.id, gids: [] };
  }
}

async function saveWishlist(
  admin: any,
  customerId: string,
  metafieldId: string | null,
  gids: string[]
) {
  const metafieldInput: any = {
    namespace: "custom",
    key: "favourites_prod",
    type: "list.product_reference",
    value: JSON.stringify(gids),
  };
  if (metafieldId) metafieldInput.id = metafieldId;

  const response = await admin.graphql(UPDATE_WISHLIST_MUTATION, {
    variables: { input: { id: customerId, metafields: [metafieldInput] } },
  });
  const json = await response.json();
  const errors = json?.data?.customerUpdate?.userErrors ?? [];
  if (errors.length) throw new Error(errors.map((e: any) => e.message).join(", "));
}

export async function getWishlistProducts(admin: any, customerId: string) {
  const { gids } = await getWishlistState(admin, customerId);
  if (gids.length === 0) return [];

  const response = await admin.graphql(GET_PRODUCTS_DATA_QUERY, { variables: { ids: gids } });
  const json = await response.json();
  return (json?.data?.nodes ?? []).filter(Boolean);
}

export async function toggleWishlistItem(admin: any, customerId: string, handle: string) {
  const productResponse = await admin.graphql(GET_PRODUCT_GID_QUERY, {
    variables: { query: `handle:${handle}` },
  });
  const productJson = await productResponse.json();
  const productGid = productJson?.data?.products?.nodes?.[0]?.id;
  if (!productGid) throw new Error(`Prodotto non trovato: ${handle}`);

  const { id: metafieldId, gids } = await getWishlistState(admin, customerId);

  const idx = gids.indexOf(productGid);
  let added: boolean;
  if (idx === -1) {
    gids.push(productGid);
    added = true;
  } else {
    gids.splice(idx, 1);
    added = false;
  }

  await saveWishlist(admin, customerId, metafieldId, gids);
  return { added, handle };
}
