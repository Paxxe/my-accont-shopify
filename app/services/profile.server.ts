const UPDATE_PROFILE_MUTATION = `#graphql
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        firstName
        lastName
        phone
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function updateCustomerProfile(
  admin: any,
  customerId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
    bdNS?: string;
    bdKey?: string;
  }
) {
  const { birthDate, bdNS = "custom", bdKey = "birth_date", ...profileData } = data;
  const input: any = { id: customerId, ...profileData };
  if (birthDate) {
    input.metafields = [
      { namespace: bdNS, key: bdKey, value: birthDate, type: "date" },
    ];
  }
  const response = await admin.graphql(UPDATE_PROFILE_MUTATION, {
    variables: { input },
  });

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  const result = json.data.customerUpdate;

  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e: any) => e.message).join(", "));
  }

  return result.customer;
}
