import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MoMoClient, MoMoError } from '../dist/esm/index.js';

const config = {
  baseUrl: 'https://sandbox.momodeveloper.mtn.com/',
  apiUser: 'api-user',
  apiKey: 'api-key',
  subscriptionKey: 'collection-key',
  disbursementSubscriptionKey: 'disbursement-key',
  targetEnvironment: 'sandbox',
};

const tokenResponse = {
  access_token: 'access-token',
  token_type: 'access_token',
  expires_in: 3600,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetch(t, handler) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

function fetchWithToken(apiHandler) {
  return async (url, options) => {
    if (url.endsWith('/collection/token/')) return jsonResponse(tokenResponse);
    return apiHandler(url, options);
  };
}

test('validates required configuration and removes a trailing base URL slash', () => {
  assert.throws(() => new MoMoClient({ ...config, baseUrl: '' }), {
    message: '[MoMo] config.baseUrl is required',
  });

  const client = new MoMoClient(config);
  assert.equal(client.baseUrl, 'https://sandbox.momodeveloper.mtn.com');
});

test('treats blank config values and missing params as invalid input', async () => {
  assert.throws(() => new MoMoClient({ ...config, baseUrl: '   ' }), {
    message: '[MoMo] config.baseUrl is required',
  });

  const client = new MoMoClient(config);
  await assert.rejects(client.requestToPay(undefined), MoMoError);
  await assert.rejects(client.sendDeliveryNotification(undefined), MoMoError);
});

test('requestToPay authenticates, sends the payment, and reuses its cached token', async (t) => {
  const calls = [];
  installFetch(t, async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/collection/token/')) return jsonResponse(tokenResponse);
    return new Response(null, { status: 202 });
  });

  const client = new MoMoClient(config);
  const params = {
    amount: '100',
    currency: 'UGX',
    externalId: 'order-1',
    payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
    payerMessage: 'Payment',
    payeeNote: 'Order 1',
    requestId: 'payment-ref',
    callbackUrl: 'https://merchant.example/callback',
  };

  assert.deepEqual(await client.requestToPay(params), { requestId: 'payment-ref' });
  assert.deepEqual(await client.requestToPay({ ...params, requestId: 'payment-ref-2' }), {
    requestId: 'payment-ref-2',
  });

  assert.equal(calls.filter(({ url }) => url.endsWith('/collection/token/')).length, 1);
  const tokenCall = calls[0];
  assert.equal(tokenCall.options.method, 'POST');
  assert.equal(
    new Headers(tokenCall.options.headers).get('Authorization'),
    `Basic ${Buffer.from('api-user:api-key').toString('base64')}`,
  );
  assert.equal(
    new Headers(tokenCall.options.headers).get('Ocp-Apim-Subscription-Key'),
    'collection-key',
  );

  const paymentCall = calls[1];
  assert.equal(paymentCall.url, 'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay');
  assert.equal(paymentCall.options.method, 'POST');
  const paymentHeaders = new Headers(paymentCall.options.headers);
  assert.equal(paymentHeaders.get('Authorization'), 'Bearer access-token');
  assert.equal(paymentHeaders.get('X-Reference-Id'), 'payment-ref');
  assert.equal(paymentHeaders.get('X-Target-Environment'), 'sandbox');
  assert.equal(paymentHeaders.get('Ocp-Apim-Subscription-Key'), 'collection-key');
  assert.equal(paymentHeaders.get('X-Callback-Url'), 'https://merchant.example/callback');
  assert.deepEqual(JSON.parse(paymentCall.options.body), {
    amount: '100',
    currency: 'UGX',
    externalId: 'order-1',
    payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
    payerMessage: 'Payment',
    payeeNote: 'Order 1',
  });
});

test('checks account activity and basic user details using disbursement credentials', async (t) => {
  const calls = [];
  installFetch(t, fetchWithToken(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/active')) return jsonResponse({ result: true });
    return jsonResponse({ sub: 'user-1', given_name: 'Ada', family_name: 'User' });
  }));

  const client = new MoMoClient(config);
  assert.deepEqual(await client.checkAccount('25677 123/456'), { result: true });
  assert.deepEqual(await client.checkNames('256771234567'), {
    sub: 'user-1',
    given_name: 'Ada',
    family_name: 'User',
  });

  assert.equal(
    calls[0].url,
    'https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/accountholder/msisdn/25677%20123%2F456/active',
  );
  assert.equal(calls[1].url.endsWith('/msisdn/256771234567/basicuserinfo'), true);
  for (const { options } of calls) {
    const headers = new Headers(options.headers);
    assert.equal(headers.get('Authorization'), 'Bearer access-token');
    assert.equal(headers.get('Ocp-Apim-Subscription-Key'), 'disbursement-key');
  }
});

test('fetches request-to-pay status and encodes its request ID', async (t) => {
  let apiCall;
  installFetch(t, fetchWithToken(async (url, options) => {
    apiCall = { url, options };
    return jsonResponse({
      externalId: 'order-1',
      amount: '100',
      currency: 'UGX',
      payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
      payerMessage: 'Payment',
      payeeNote: 'Order 1',
      status: 'SUCCESSFUL',
    });
  }));

  const status = await new MoMoClient(config).getRequestToPayStatus('ref/with space');
  assert.equal(status.status, 'SUCCESSFUL');
  assert.equal(
    apiCall.url,
    'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/ref%2Fwith%20space',
  );
  assert.equal(apiCall.options.method, 'GET');
});

test('sends delivery notifications and enforces required fields and message length', async (t) => {
  const calls = [];
  installFetch(t, fetchWithToken(async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: 202 });
  }));

  const client = new MoMoClient(config);
  await client.sendDeliveryNotification({
    requestId: 'payment-ref',
    notificationMessage: 'Delivered',
  });

  assert.equal(
    calls[0].url,
    'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/payment-ref/deliverynotification',
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), { notificationMessage: 'Delivered' });

  await assert.rejects(
    client.sendDeliveryNotification({ requestId: 'payment-ref', notificationMessage: 'x'.repeat(161) }),
    (error) => error instanceof MoMoError && /160 characters/.test(error.message),
  );
  await assert.rejects(
    client.sendDeliveryNotification({ requestId: '', notificationMessage: 'Delivered' }),
    (error) => error instanceof MoMoError && /requestId is required/.test(error.message),
  );
});

test('creates a refund and retrieves its status', async (t) => {
  const calls = [];
  installFetch(t, fetchWithToken(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/refund')) return new Response(null, { status: 202 });
    return jsonResponse({
      externalId: 'refund-1',
      amount: '100',
      currency: 'UGX',
      payerMessage: 'Refund',
      payeeNote: 'Order 1 refund',
      status: 'PENDING',
    });
  }));

  const client = new MoMoClient(config);
  assert.deepEqual(await client.refund({
    amount: '100',
    currency: 'UGX',
    externalId: 'refund-1',
    payerMessage: 'Refund',
    payeeNote: 'Order 1 refund',
    referenceIdToRefund: 'payment-ref',
    requestId: 'refund-ref',
    callbackUrl: 'https://merchant.example/refund',
  }), { requestIdRefund: 'refund-ref' });

  const refundCall = calls[0];
  assert.equal(refundCall.url, 'https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/refund');
  const headers = new Headers(refundCall.options.headers);
  assert.equal(headers.get('X-Reference-Id'), 'refund-ref');
  assert.equal(headers.get('Ocp-Apim-Subscription-Key'), 'disbursement-key');
  assert.equal(headers.get('X-Callback-Url'), 'https://merchant.example/refund');
  assert.deepEqual(JSON.parse(refundCall.options.body), {
    amount: '100',
    currency: 'UGX',
    externalId: 'refund-1',
    payerMessage: 'Refund',
    payeeNote: 'Order 1 refund',
    referenceIdToRefund: 'payment-ref',
  });

  const status = await client.getRefundStatus('refund/ref');
  assert.equal(status.status, 'PENDING');
  assert.equal(
    calls[1].url,
    'https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/refund/refund%2Fref',
  );
});

test('surfaces structured HTTP errors', async (t) => {
  installFetch(t, fetchWithToken(async () => jsonResponse({ message: 'Rejected' }, 400)));
  const client = new MoMoClient(config);

  await assert.rejects(client.checkAccount('256771234567'), (error) => {
    assert.ok(error instanceof MoMoError);
    assert.equal(error.statusCode, 400);
    assert.deepEqual(error.body, { message: 'Rejected' });
    assert.match(error.message, /HTTP 400/);
    return true;
  });
});

test('preserves the cause of network errors', async (t) => {
  installFetch(t, async () => {
    throw new Error('connection refused');
  });
  const client = new MoMoClient(config);
  await assert.rejects(client.generateAccessToken(), (error) => {
    assert.ok(error instanceof MoMoError);
    assert.match(error.message, /network error/);
    assert.equal(error.cause.message, 'connection refused');
    return true;
  });
});

test('rejects invalid payment, refund, and status inputs before making requests', async (t) => {
  let calls = 0;
  installFetch(t, async () => {
    calls += 1;
    return jsonResponse(tokenResponse);
  });
  const client = new MoMoClient(config);

  await assert.rejects(client.requestToPay({}), MoMoError);
  await assert.rejects(client.refund({}), MoMoError);
  await assert.rejects(client.checkNames(''), MoMoError);
  await assert.rejects(client.getRequestToPayStatus(''), MoMoError);
  await assert.rejects(client.getRefundStatus(''), MoMoError);
  assert.equal(calls, 0);
});
