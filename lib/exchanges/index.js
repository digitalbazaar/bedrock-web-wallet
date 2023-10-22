/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as chapiDirect from './chapiDirect.js';
import * as oid4vci from './oid4vci.js';
import * as oid4vp from './oid4vp.js';
import * as vcapi from './vcapi.js';
import {config} from '@bedrock/web';
import {prettify} from '../helpers.js';

const EXCHANGE_FACTORIES = new Map([
  ['chapiDirect', chapiDirect.createIfSupported],
  ['OID4VCI', oid4vci.createIfSupported],
  ['OID4VP', oid4vp.createIfSupported],
  ['vcapi', vcapi.createIfSupported]
]);

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
  // commonly useful debugging
  if(event?.credential?.dataType === 'VerifiablePresentation' &&
    event.credential.data) {
    const data = event.credential.data;
    console.log('CHAPI: incoming VP: ', prettify(data, null, 2));
  } else if(event?.credentialRequestOptions?.web?.VerifiablePresentation) {
    const vpr = event.credentialRequestOptions.web.VerifiablePresentation;
    console.log('CHAPI: incoming VPR: ', prettify(vpr, null, 2));
  }

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

  // no compatible exchange protocol
  let error;
  if(event.type === 'credentialstore') {
    error = new Error(
      'The credential offer is not compatible with this wallet.');
  } else {
    error = new Error(
      'The credential request is not compatible with this wallet.');
  }
  throw error;
}
