// VivaWallet Smart Checkout integration helpers (server-side only).
// Docs : https://developer.vivawallet.com/integration-reference/smart-checkout/
//
// Flow :
// 1. POST /connect/token (OAuth2 client_credentials) → access_token (1h)
// 2. POST /checkout/v2/orders → orderCode
// 3. Redirect client : https://{checkoutDomain}/web/checkout?ref={orderCode}
// 4. VivaWallet redirige client vers successUrl ou failUrl avec query params
// 5. Webhook server confirme le paiement → met à jour booking en DB

const ENV = {
  api: process.env.VIVA_API_URL || 'https://demo-api.vivapayments.com',
  accounts: process.env.VIVA_ACCOUNTS_URL || 'https://demo-accounts.vivapayments.com',
  checkout: process.env.VIVA_CHECKOUT_URL || 'https://demo.vivapayments.com',
};

let _tokenCache = null; // { token, expiresAt }

export async function getVivaAccessToken() {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.token;
  }
  const clientId = process.env.VIVA_CLIENT_ID;
  const clientSecret = process.env.VIVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('VIVA_CLIENT_ID / VIVA_CLIENT_SECRET missing in env');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${ENV.accounts}/connect/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=urn:viva:payments:core:api:redirectcheckout',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Viva auth failed (${res.status}): ${txt}`);
  }
  const data = await res.json();
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return _tokenCache.token;
}

// Crée un order VivaWallet et renvoie l'orderCode + checkoutUrl
// amount = total TTC en EUROS (sera converti en cents)
// merchantTrns = visible dans le dashboard VivaWallet (notre référence booking)
// customerTrns = visible par le client sur le checkout
export async function createVivaOrder({ amount, merchantTrns, customerTrns, customer = {} }) {
  if (!(amount > 0)) throw new Error('amount must be > 0');
  const sourceCode = process.env.VIVA_SOURCE_CODE;
  if (!sourceCode) throw new Error('VIVA_SOURCE_CODE missing in env');

  const token = await getVivaAccessToken();
  const amountCents = Math.round(amount * 100);

  const body = {
    amount: amountCents,
    sourceCode,
    merchantTrns: merchantTrns || '',
    customerTrns: customerTrns || 'Multiwex — réservation',
    paymentTimeout: 1800, // 30 min pour payer
    preauth: false,
    allowRecurring: false,
    maxInstallments: 0,
    paymentNotification: true,
    customer: {
      email: customer.email || '',
      fullName: customer.name || '',
      phone: customer.phone || '',
      countryCode: customer.country || 'BE',
      requestLang: 'fr-FR',
    },
  };

  const res = await fetch(`${ENV.api}/checkout/v2/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Viva createOrder failed (${res.status}): ${txt}`);
  }
  const data = await res.json();
  // VivaWallet renvoie { orderCode: 1234567890123456 }
  const orderCode = data.orderCode || data.OrderCode;
  if (!orderCode) throw new Error('No orderCode in Viva response');

  return {
    orderCode: String(orderCode),
    checkoutUrl: `${ENV.checkout}/web/checkout?ref=${orderCode}`,
  };
}

// Récupère le détail d'une transaction (pour vérifier paiement côté webhook)
export async function getVivaTransaction(transactionId) {
  const token = await getVivaAccessToken();
  const res = await fetch(`${ENV.api}/checkout/v2/transactions/${transactionId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Viva getTransaction failed (${res.status})`);
  return await res.json();
}
