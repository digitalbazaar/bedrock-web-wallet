/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc.
 */
import * as chapiDirect from './chapiDirect.js';
import * as oid4vci from './oid4vci.js';
import * as oid4vp from './oid4vp.js';
import * as vcapi from './vcapi.js';
import {ClientInteraction} from './ClientInteraction.js';
import {config} from '@bedrock/web';
import {httpClient} from '@digitalbazaar/http-client';
import {prettify} from '../helpers.js';

const EXCHANGE_FACTORIES = new Map([
  ['chapiDirect', chapiDirect.createIfSupported],
  ['OID4VCI', oid4vci.createIfSupported],
  ['OID4VP', oid4vp.createIfSupported],
  ['vcapi', vcapi.createIfSupported]
]);

/**
 * Starts a new exchange based off the given CHAPI event. The exchange
 * mechanism to use is auto-selected based off of configuration options.
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

  // pre-process any event protocols, looking for `interact` or `interaction`
  // protocol URLs; they are an indirection for fetching the full protocol list
  // from the coordinator system whilst ensuring they are delivered from the
  // origin of interest; if available, use the protocols retrieved from an
  // interaction URL to replace any protocols mentioned in the event's
  // `credentialRequestOptions.web.protocols` or
  // `event.credential.options.protocols'
  const protocols = event.credentialRequestOptions?.web?.protocols ??
    event.credential?.options?.protocols;
  console.log('Original protocols provided via CHAPI event', protocols);
  const interactionUrl = protocols?.interact ?? protocols?.interaction;
  const interaction = new ClientInteraction({
    interactionUrl,
    origin: event.credentialRequestOrigin,
    async getProtocols({url}) {
      if(url === null) {
        return protocols ?? {};
      }
      console.log('Fetching interaction URL', url);
      // FIXME: fetch via proxy through wallet service instead of directly to
      // improve privacy characteristics
      const response = await httpClient.get(url);
      return response.data?.protocols;
    }
  });

  try {
    if(interactionUrl) {
      const protocols = await interaction.getProtocols();
      console.log('Protocols fetched from interaction URL', protocols);
    }
  } catch(e) {
    console.log('Failed to fetch interaction protocols', e);
  }

  // get configured accepted protocols in order of preference; try to create
  // an exchange instance for each until one is successful
  const {acceptedProtocols} = config.wallet.exchanges;
  console.log('Accepted protocols in preference order', acceptedProtocols);
  for(const protocol of acceptedProtocols) {
    const create = EXCHANGE_FACTORIES.get(protocol);
    const exchange = await create?.({interaction, event});
    if(exchange) {
      console.log('Selected exchange protocol:', protocol);
      // bind exchange result to CHAPI event and transform it for transport
      event.respondWith(exchange.result.then(result => {
        return exchange._outOfBand ? {
          dataType: 'OutOfBand',
          data: null
        } : {
          dataType: 'VerifiablePresentation',
          data: result.verifiablePresentation
        };
      }));
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
