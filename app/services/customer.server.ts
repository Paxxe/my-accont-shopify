const CUSTOMER_QUERY = `#graphql
  query CustomerData($id: ID!, $bdNS: String!, $bdKey: String!) {
    customer(id: $id) {
      id
      email
      firstName
      lastName
      phone
      defaultAddress {
        id
        address1
        address2
        city
        province
        zip
        country
        countryCodeV2
      }
      addresses(first: 20) {
        id
        address1
        address2
        city
        province
        zip
        country
        countryCodeV2
        firstName
        lastName
        company
        phone
      }
      metafield(namespace: "custom", key: "custom_marketing_preferences") {
        id
        value
      }
      birthdateField: metafield(namespace: $bdNS, key: $bdKey) {
        id
        value
      }
      emailMarketingConsent {
        marketingState
        marketingOptInLevel
        consentUpdatedAt
      }
      smsMarketingConsent {
        marketingState
        marketingOptInLevel
        consentUpdatedAt
      }
    }
  }
`;

export async function getCustomerData(
  admin: any,
  customerId: string,
  bdNS = "custom",
  bdKey = "birth_date"
) {
  const response = await admin.graphql(CUSTOMER_QUERY, {
    variables: { id: customerId, bdNS, bdKey },
  });

  const json = await response.json();

  if (json.errors?.length) {
    console.error("[CUSTOMER QUERY] GraphQL errors:", json.errors);
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  return json?.data?.customer ?? null;
}
