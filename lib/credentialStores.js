/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {VerifiableCredentialStore} from '@bedrock/web-vc-store';

/**
 * Creates the local and remote `VerifiableCredentialStore`s, pairing each
 * store's EDV client with the construction options from its own config block
 * (`credentialStoreConfig.local.options` /
 * `credentialStoreConfig.remote.options`).
 *
 * @param {object} options - The options to use.
 * @param {object} options.credentialStoreConfig - The credential store
 *   config object, with `local` and `remote` sub-configs, which can be
 *   obtained from `config.wallet.credentialStore` in the bedrock config.
 * @param {object} options.localEdvClient - The EDV client for the local store.
 * @param {object} options.remoteEdvClient - The EDV client for the remote
 *   store.
 *
 * @returns {{local: object, remote: object}} The local and remote
 *   `VerifiableCredentialStore` instances.
 */
export function createCredentialStores({
  credentialStoreConfig, localEdvClient, remoteEdvClient
}) {
  const {local: {options: localOptions}} = credentialStoreConfig;
  const {remote: {options: remoteOptions}} = credentialStoreConfig;
  return {
    local: new VerifiableCredentialStore(
      {...localOptions, edvClient: localEdvClient}),
    remote: new VerifiableCredentialStore(
      {...remoteOptions, edvClient: remoteEdvClient})
  };
}
