const UPDATE_MARKETING_PREFERENCES_MUTATION = `#graphql
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        metafield(namespace: "custom", key: "custom_marketing_preferences") {
          id
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function updateMarketingPreferences(
  admin: any,
  customerId: string,
  values: string[]
) {
  const response = await admin.graphql(UPDATE_MARKETING_PREFERENCES_MUTATION, {
    variables: {
      input: {
        id: customerId,
        metafields: [
          {
            namespace: "custom",
            key: "custom_marketing_preferences",
            value: JSON.stringify(values),
            type: "list.single_line_text_field",
          },
        ],
      },
    },
  });

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  const result = json.data.customerUpdate;

  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e: any) => e.message).join(", "));
  }

  return result.customer.metafield;
}
