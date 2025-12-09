/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {v4 as uuid} from 'uuid';

const DOCUMENT_TYPE = 'EthereumKeyDocument';

/**
 * Stores an Ethereum key in the EDV.
 *
 * @param {object} options - The options to use.
 * @param {object} options.edvClient - The EDV client.
 * @param {string} options.address - The Ethereum address.
 * @param {string} options.privateKey - The private key.
 * @param {string} options.publicKey - The public key.
 * @param {string} options.derivationPath - The derivation path.
 * @param {string} [options.mnemonic] - The mnemonic phrase.
 * @param {string} [options.network='usbc-sandbox'] - The network identifier.
 *
 * @returns {Promise<object>} The stored document.
 */
export async function storeKey({
  edvClient,
  address,
  privateKey,
  publicKey,
  derivationPath,
  mnemonic,
  network = 'usbc-sandbox'
} = {}) {
  if(!edvClient) {
    throw new TypeError('edvClient is required.');
  }
  if(!address) {
    throw new TypeError('address is required.');
  }
  if(!privateKey) {
    throw new TypeError('privateKey is required.');
  }

  const doc = {
    id: await edvClient.generatedId(),
    content: {
      id: `urn:uuid:${uuid()}`,
      type: DOCUMENT_TYPE,
      address: address.toLowerCase(),
      privateKey,
      publicKey,
      derivationPath,
      mnemonic,
      network,
      created: new Date().toISOString()
    }
  };

  return edvClient.insert({doc});
}

/**
 * Gets an Ethereum key by address.
 *
 * @param {object} options - The options to use.
 * @param {object} options.edvClient - The EDV client.
 * @param {string} options.address - The Ethereum address.
 *
 * @returns {Promise<object|null>} The key document or null if not found.
 */
export async function getKeyByAddress({edvClient, address} = {}) {
  if(!edvClient) {
    throw new TypeError('edvClient is required.');
  }
  if(!address) {
    throw new TypeError('address is required.');
  }

  const {documents} = await edvClient.find({
    equals: {'content.address': address.toLowerCase()}
  });

  return documents[0] || null;
}

/**
 * Lists all Ethereum keys.
 *
 * @param {object} options - The options to use.
 * @param {object} options.edvClient - The EDV client.
 *
 * @returns {Promise<Array>} Array of key documents.
 */
export async function listKeys({edvClient} = {}) {
  if(!edvClient) {
    throw new TypeError('edvClient is required.');
  }

  const {documents} = await edvClient.find({
    equals: {'content.type': DOCUMENT_TYPE}
  });

  return documents;
}

/**
 * Deletes an Ethereum key by document ID.
 *
 * @param {object} options - The options to use.
 * @param {object} options.edvClient - The EDV client.
 * @param {string} options.id - The document ID.
 *
 * @returns {Promise<boolean>} True if deleted.
 */
export async function deleteKey({edvClient, id} = {}) {
  if(!edvClient) {
    throw new TypeError('edvClient is required.');
  }
  if(!id) {
    throw new TypeError('"id" is required.');
  }

  const doc = await edvClient.get({id});
  return edvClient.delete({doc});
}
