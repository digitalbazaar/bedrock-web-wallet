# Bedrock Web Wallet _(@bedrock/web-wallet)_

[![Build Status](https://img.shields.io/github/actions/workflow/status/digitalbazaar/bedrock-web-wallet/main.yaml)](https://github.com/digitalbazaar/bedrock-web-wallet/actions/workflows/main.yaml)
[![NPM Version](https://img.shields.io/npm/v/@bedrock/web-wallet.svg)](https://npm.im/@bedrock/web-wallet)

> A browser-based digital wallet library for managing and presenting W3C Verifiable Credentials in Bedrock applications.

This library provides the client-side building blocks for a digital credential
wallet: storing Verifiable Credentials (VCs) in encrypted data vaults (EDVs),
running credential exchanges over multiple protocols, and signing Verifiable
Presentations (VPs) with data integrity proofs.

## Table of Contents

- [Background](#background)
- [Security](#security)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Configuration](#configuration)
- [Contribute](#contribute)
- [Commercial Support](#commercial-support)
- [License](#license)

## Background

`@bedrock/web-wallet` runs in the browser and coordinates a number of Digital
Bazaar libraries to implement a Verifiable Credentials wallet:

- **Storage** — credentials are stored in a per-profile
  [`VerifiableCredentialStore`](https://github.com/digitalbazaar/bedrock-web-vc-store)
  backed by an [Encrypted Data Vault](https://github.com/digitalbazaar/edv-client).
  Each profile uses a dual store: a server-synced **remote** store and a
  browser-local **PouchDB** store.
- **Profiles and access** — profiles, profile agents, and delegated authority
  capabilities (zcaps) are managed through
  [`@bedrock/web-profile-manager`](https://github.com/digitalbazaar/bedrock-web-profile-manager).
- **Exchanges** — credential issuance and presentation flows are handled over
  several protocols, auto-selected from a configured preference order:
  - `vcapi` — [VC API](https://w3c-ccg.github.io/vc-api/) exchanges.
  - `OID4VCI` — OpenID for Verifiable Credential Issuance.
  - `OID4VP` — OpenID for Verifiable Presentations.
  - `chapiDirect` — direct
    [CHAPI](https://chapi.io/) exchanges.
- **Presentations** — VPs are signed with selectable data integrity
  cryptosuites and matched against Verifiable Presentation Requests (VPRs),
  including selective disclosure (`bbs-2023`, `ecdsa-sd-2023`).

This library exposes building blocks, not a UI. It is intended to be consumed
by a Bedrock web application that supplies its own user interface (for example,
a [Quasar](https://quasar.dev/) / Vue front end) and a Bedrock backend that
provides EDV, KMS, meter, and profile services.

## Security

This library handles private credential data and cryptographic key material.
Note in particular:

- Verifiable Presentations are pruned against a configurable proof allow list
  (`config.wallet.presentations.proofAllowList`) before they leave the wallet,
  to avoid sharing proof metadata the user has not consented to share.
- The local credential store is encrypted with a per-profile password supplied
  to `getCredentialStore`. That password is required to unlock local secrets.
- Internal state (cached EDV clients and credential stores) is reset whenever
  the session account changes, so credentials are not leaked across accounts.

## Install

- Node.js 22+ is required.

### NPM

To install via NPM:

```
npm install --save @bedrock/web-wallet
```

### Peer dependencies

This module is intended for use within a Bedrock web application and declares
the following peer dependencies:

- `@bedrock/web`
- `@bedrock/web-account`
- `@bedrock/web-pouch-edv`
- `@bedrock/web-profile-manager`
- `@bedrock/web-session`
- `@bedrock/web-vc-store`

### Development

To install locally (for development):

```
git clone https://github.com/digitalbazaar/bedrock-web-wallet.git
cd bedrock-web-wallet
npm install
```

## Usage

### Initialize the wallet

Import the library and call `initialize()` once, after configuring any defaults.
Initialization creates the profile manager, binds it to the current session, and
sets up internal caches. It must be called exactly once per page load.

```js
import {config} from '@bedrock/web';
import * as webWallet from '@bedrock/web-wallet';

// optionally override defaults before initializing
config.wallet.defaults.edvBaseUrl = `${window.location.origin}/edvs`;

await webWallet.initialize();
```

### Get a credential store

A credential store is obtained per profile. The `password` unlocks the
browser-local store for that profile. Results are cached.

```js
const credentialStore = await webWallet.getCredentialStore({
  profileId, password
});

// add one or more credentials (written to both local and remote stores)
await credentialStore.add({credentials: [verifiableCredential]});

// delete a credential by id
await credentialStore.delete({id: credentialId});
```

### Run a credential exchange

Exchanges are started from a [CHAPI](https://chapi.io/) event. The exchange
protocol is auto-selected from the configured preference order. The returned
`Exchange` is advanced by calling `next()`, which works like an async iterator
step: each call resolves to `{value, done}`.

When `value` contains a `verifiablePresentationRequest`, the caller is expected
to build a matching presentation and pass it back into the next `next()` call
(optionally with `signOptions` so the wallet signs it). When `done` is `true`,
`value` may contain the resulting `verifiablePresentation` and/or a
`redirectUrl`.

```js
const exchange = await webWallet.exchanges.start({event});

let result = await exchange.next();
while(!result.done) {
  const {verifiablePresentationRequest} = result.value;

  // build a presentation that satisfies the request (e.g. via
  // `presentations.match()`), then continue the exchange, signing as needed
  result = await exchange.next({
    verifiablePresentation,
    signOptions: {profileId}
  });
}

// `result.value` may include `verifiablePresentation` and/or `redirectUrl`
```

Call `exchange.cancel()` to abandon an in-progress exchange.

### Sign a presentation

```js
const signedPresentation = await webWallet.presentations.sign({
  challenge,
  domain,
  profileId,
  presentation: unsignedPresentation,
  // optional; defaults to `config.wallet.defaults.signatureSuite`
  acceptedCryptosuites: [{cryptosuite: 'eddsa-rdfc-2022'}]
});
```

### Match credentials against a request

```js
const {flat, and} = await webWallet.presentations.match({
  verifiablePresentationRequest,
  credentialStore
});
```

## API

The package's main export (`@bedrock/web-wallet`) exposes:

### State / lifecycle

- `initialize()` — initialize the wallet (call once).
- `profileManager` — the shared `ProfileManager` instance (available after
  `initialize()`).
- `getCredentialStore({profileId, password})` — get (and cache) a
  `CredentialStore` for a profile.
- `getProfileEdvClient({profileId, referenceIdPrefix})` — get (and cache) an
  EDV client for a profile.

### Namespaces

- `exchanges` — `start({event})` selects and starts a credential exchange.
- `presentations` — `sign()`, `match()`, and `pruneCredentialProofs()`.
- `helpers` — profile and capability helpers (`createProfile`,
  `createCapabilities`, NFC payload helpers, etc.).
- `inbox` — `initiateVcExchange()` and `transferCredentials()` for the
  profile inbox.
- `users` — `addUser()`, `updateUser()`, `removeUser()`, `createOnboardLink()`.
- `capabilities` — authority capability (zcap) helpers.
- `cryptosuites` — supported data integrity cryptosuites.
- `ageCredentialHelpers` — helpers for age-verification credentials.
- `nfcRenderer` — render credentials to NFC payloads.
- `validator` — request/response validation.
- `zcap` — zcap delegation utilities.
- `documentLoader` — the JSON-LD document loader used for VC operations.

## Configuration

Configuration lives on `config.wallet` (from `@bedrock/web`) and is populated
with defaults when the library is imported. Override values **before** calling
`initialize()`. Notable settings:

- `defaults.edvBaseUrl` — base URL for the EDV service.
- `defaults.signatureSuite` — default cryptosuite for signing presentations.
- `defaults.edvs` — reference id prefixes for the `credentials` and `inbox`
  EDVs.
- `caches` — LRU cache sizes and TTLs for EDV clients and credential stores.
- `credentialStore.local` / `credentialStore.remote` — construction options and
  credential filters (including bundling rules) for each store.
- `exchanges.acceptedProtocols` — exchange protocols in order of preference.
- `exchanges.limits` — caps on VPR query counts.
- `presentations.proofAllowList` — proof types/cryptosuites permitted in
  presentations.

## Contribute

See [the contribute file](https://github.com/digitalbazaar/bedrock/blob/main/CONTRIBUTING.md)!

PRs accepted.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## Commercial Support

Commercial support for this library is available upon request from
Digital Bazaar: support@digitalbazaar.com

## License

[Bedrock Non-Commercial License v1.0](LICENSE.md) © Digital Bazaar
