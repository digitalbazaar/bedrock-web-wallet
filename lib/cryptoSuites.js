/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {Ed25519Signature2018} from '@digitalbazaar/ed25519-signature-2018';
import {Ed25519Signature2020} from '@digitalbazaar/ed25519-signature-2020';

export const supported = new Map([
  ['Ed25519Signature2018', Ed25519Signature2018],
  ['Ed25519Signature2020', Ed25519Signature2020]
]);
