const UPDATE_EMAIL_CONSENT_MUTATION = `#graphql
  mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
        emailMarketingConsent {
          marketingState
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_SMS_CONSENT_MUTATION = `#graphql
  mutation customerSmsMarketingConsentUpdate($input: CustomerSmsMarketingConsentUpdateInput!) {
    customerSmsMarketingConsentUpdate(input: $input) {
      customer {
        id
        smsMarketingConsent {
          marketingState
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function updateMarketingConsent(
  admin: any,
  customerId: string,
  emailSubscribed: boolean,
  smsSubscribed: boolean,
  phone?: string | null
) {
  const mutations: Promise<any>[] = [
    admin.graphql(UPDATE_EMAIL_CONSENT_MUTATION, {
      variables: {
        input: {
          customerId,
          emailMarketingConsent: {
            marketingState: emailSubscribed ? "SUBSCRIBED" : "UNSUBSCRIBED",
            marketingOptInLevel: "SINGLE_OPT_IN",
          },
        },
      },
    }),
  ];

  if (phone) {
    mutations.push(
      admin.graphql(UPDATE_SMS_CONSENT_MUTATION, {
        variables: {
          input: {
            customerId,
            smsMarketingConsent: {
              marketingState: smsSubscribed ? "SUBSCRIBED" : "UNSUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN",
            },
          },
        },
      })
    );
  }

  const results = await Promise.all(mutations);
  const jsons = await Promise.all(results.map((r) => r.json()));

  const emailErrors = jsons[0]?.data?.customerEmailMarketingConsentUpdate?.userErrors ?? [];
  const smsErrors = jsons[1]?.data?.customerSmsMarketingConsentUpdate?.userErrors ?? [];
  const allErrors = [...emailErrors, ...smsErrors].map((e: any) => e.message);

  if (allErrors.length) throw new Error(allErrors.join(", "));

  return { ok: true };
}
