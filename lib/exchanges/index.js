/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as chapiDirect from './chapiDirect.js';
import * as oid4vci from './oid4vci.js';
import * as vcapi from './vcapi.js';
import {config} from '@bedrock/web';

const EXCHANGE_FACTORIES = new Map([
  ['chapiDirect', chapiDirect.createIfSupported],
  ['OID4VCI', oid4vci.createIfSupported],
  ['vcapi', vcapi.createIfSupported]
]);

/*
const event = await receiveCredentialEvent();
console.log('credential store event', event);

// FIXME: const exchange = await brWallet.exchanges.start({event});
// FIXME: const {value, done} = await exchange.next()
// FIXME: const {value, done} = await exchange.next({verifiablePresentation})
// FIXME: await exchange.close({error});
// FIXME: await exchange.close();

/**
 * Starts a new exchange based off the given CHAPI event. The exchange
 * machanism to use is auto-selected based off of configuration options.
 *
 * @param {object} options - The options to use.
 * @param {object} options.event - The CHAPI event.
 *
 * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
 */
export async function start({event} = {}) {
  // get configured accepted protocols in order of preference; try to create
  // an exchange instance for each until one is successful
  const {acceptedProtocols} = config.wallet.exchanges;
  for(const protocol of acceptedProtocols) {
    const create = EXCHANGE_FACTORIES.get(protocol);
    const exchange = await create?.({event});
    if(exchange) {
      return exchange;
    }
  }

  // FIXME: determine if `event.respondWith` should be passed a rejected
  // promise with this error
  throw new Error('Could not determine an acceptable exchange protocol.');
}
