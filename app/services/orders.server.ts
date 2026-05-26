const ORDERS_QUERY = `#graphql
  query CustomerOrders($id: ID!) {
    customer(id: $id) {
      id
      orders(first: 10, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

const ORDER_DETAIL_QUERY = `#graphql
  query OrderDetail($id: ID!) {
    order(id: $id) {
      id
      name
      processedAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney { amount currencyCode }
      }
      subtotalPriceSet {
        shopMoney { amount currencyCode }
      }
      totalShippingPriceSet {
        shopMoney { amount currencyCode }
      }
      lineItems(first: 50) {
        nodes {
          title
          quantity
          image {
            url
            altText
          }
          variant {
            price
          }
          originalTotalSet {
            shopMoney { amount currencyCode }
          }
        }
      }
      shippingAddress {
        address1
        address2
        city
        zip
        country
      }
      fulfillments {
        trackingInfo {
          number
          url
        }
      }
    }
  }
`;

export async function getOrderDetail(admin: any, orderId: string) {
  const response = await admin.graphql(ORDER_DETAIL_QUERY, {
    variables: { id: orderId },
  });

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  return json?.data?.order ?? null;
}

export async function getCustomerOrders(admin: any, customerId: string) {
  const response = await admin.graphql(ORDERS_QUERY, {
    variables: { id: customerId },
  });

  const json = await response.json();
  
  if (json.errors?.length) {
    console.error("[ORDERS QUERY] GraphQL errors:", json.errors);
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }
  
  return json?.data?.customer?.orders?.nodes ?? [];
}