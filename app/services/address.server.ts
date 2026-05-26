export async function deleteCustomerAddress(
  session: { shop: string; accessToken: string },
  customerId: string,
  addressId: string
) {
  const customerNumericId = customerId.split("?")[0].split("/").pop();
  const addressNumericId = addressId.split("?")[0].split("/").pop();

  const response = await fetch(
    `https://${session.shop}/admin/api/2024-10/customers/${customerNumericId}/addresses/${addressNumericId}.json`,
    {
      method: "DELETE",
      headers: { "X-Shopify-Access-Token": session.accessToken },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`REST error: ${response.status} — ${text}`);
  }

  return { ok: true };
}

export async function setDefaultAddress(
  session: { shop: string; accessToken: string },
  customerId: string,
  addressId: string
) {
  const customerNumericId = customerId.split("?")[0].split("/").pop();
  const addressNumericId = addressId.split("?")[0].split("/").pop();

  const response = await fetch(
    `https://${session.shop}/admin/api/2024-10/customers/${customerNumericId}/addresses/${addressNumericId}/default.json`,
    {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": session.accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`REST error: ${response.status} — ${text}`);
  }

  return { ok: true };
}

const CREATE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressCreate($customerId: ID!, $address: MailingAddressInput!) {
    customerAddressCreate(customerId: $customerId, address: $address) {
      userErrors {
        field
        message
      }
    }
  }
`;

export async function createCustomerAddress(
  admin: any,
  customerId: string,
  address: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
  }
) {
  const response = await admin.graphql(CREATE_ADDRESS_MUTATION, {
    variables: { customerId, address },
  });

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  const result = json.data.customerAddressCreate;

  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e: any) => e.message).join(", "));
  }

  return { ok: true };
}
