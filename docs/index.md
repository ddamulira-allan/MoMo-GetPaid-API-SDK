---
title: MoMo Get Paid SDK
---

# MoMo Get Paid SDK

A TypeScript SDK for integrating MTN MoMo Get Paid **Collection** and
**Disbursement** APIs in Node.js applications. The SDK supports Node.js 18 and
later and provides both ESM and CommonJS builds.

[View the source repository](https://github.com/ddamulira-allan/MoMo-GetPaid-API-SDK) ·
[Install from npm](https://www.npmjs.com/package/momo-get-paid-sdk)

## What you can do

- Create and check Request to Pay transactions.
- Check whether an account is active and retrieve basic account-holder info.
- Send delivery notifications.
- Initiate refunds and check their status.
- Generate and cache access tokens automatically.

## Install

```bash
npm install momo-get-paid-sdk
```

## Quick start

Keep your API credentials on the server. Do not commit them or expose them in
browser-side code.

```ts
import { MoMoClient } from 'momo-get-paid-sdk';

const client = new MoMoClient({
  baseUrl: 'https://sandbox.momodeveloper.mtn.com',
  apiUser: process.env.MOMO_API_USER!,
  apiKey: process.env.MOMO_API_KEY!,
  subscriptionKey: process.env.MOMO_COLLECTION_KEY!,
  disbursementSubscriptionKey: process.env.MOMO_DISBURSEMENT_KEY!,
  targetEnvironment: 'sandbox',
});

const { requestId } = await client.requestToPay({
  amount: '100',
  currency: 'UGX',
  externalId: 'order-001',
  payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
  payerMessage: 'Payment for order 001',
  payeeNote: 'Order 001',
});

const payment = await client.getRequestToPayStatus(requestId);
console.log(payment.status); // PENDING | SUCCESSFUL | FAILED
```

Use sandbox credentials while developing, and configure the appropriate
production API URL and credentials before making live requests. A successful
Request to Pay call is asynchronous; check its status before treating a
payment as complete.

## Available methods

| Method | Purpose |
| --- | --- |
| `generateAccessToken()` | Generate an access token; tokens are cached and refreshed automatically. |
| `checkAccount(msisdn)` | Check whether an account is active. |
| `checkNames(msisdn)` | Retrieve basic account-holder information. |
| `requestToPay(params)` | Request a payment from a payer. |
| `getRequestToPayStatus(requestId)` | Check a payment request's status. |
| `sendDeliveryNotification(params)` | Send a delivery notification for a payment. |
| `refund(params)` | Initiate a refund. |
| `getRefundStatus(requestIdRefund)` | Check a refund's status. |

SDK methods throw `MoMoError` when an API request fails. The error provides
the HTTP status code and response body for troubleshooting.

## Examples and reference

- [Full SDK guide and API reference](https://github.com/ddamulira-allan/MoMo-GetPaid-API-SDK/blob/main/API%20SDK/README.md)
- [Changelog](https://github.com/ddamulira-allan/MoMo-GetPaid-API-SDK/blob/main/API%20SDK/CHANGELOG.md)
- [Postman collection and environment](https://github.com/ddamulira-allan/MoMo-GetPaid-API-SDK/tree/main/API%20SDK/postman)
- [E-commerce checkout demo](https://github.com/ddamulira-allan/MoMo-GetPaid-API-SDK/tree/main/API%20SDK/ecommerce)

The demo is intended for local sandbox testing. It keeps orders in memory and
is not production-ready without persistent order storage and suitable
operational, privacy, and security controls.

## Links

- [MTN MoMo Developer Portal](https://momodeveloper.mtn.com/)
- [npm package](https://www.npmjs.com/package/momo-get-paid-sdk)
- [Report an issue](https://github.com/ddamulira-allan/MoMo-GetPaid-API-SDK/issues)
