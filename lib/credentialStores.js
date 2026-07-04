/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {VerifiableCredentialStore} from '@bedrock/web-vc-store';

/**
 * Creates the local and remote `VerifiableCredentialStore`s, pairing each
 * store's EDV client with the construction options from its own config block
 * (`credentialStore.local.options` / `credentialStore.remote.options`).
 *
 * @param {object} options - The options to use.
 * @param {object} options.credentialStore - The `config.wallet.credentialStore`
 *   config object, with `local` and `remote` sub-configs.
 * @param {object} options.localEdvClient - The EDV client for the local store.
 * @param {object} options.remoteEdvClient - The EDV client for the remote
 *   store.
 *
 * @returns {{local: object, remote: object}} The local and remote
 *   `VerifiableCredentialStore` instances.
 */
export function createCredentialStores({
  credentialStore, localEdvClient, remoteEdvClient
}) {
  const {local: {options: localOptions}} = credentialStore;
  const {remote: {options: remoteOptions}} = credentialStore;
  return {
    local: new VerifiableCredentialStore(
      {...localOptions, edvClient: localEdvClient}),
    remote: new VerifiableCredentialStore(
      {...remoteOptions, edvClient: remoteEdvClient})
  };
}
