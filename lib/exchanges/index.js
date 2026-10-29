/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc.
 */
import * as chapiDirect from './chapiDirect.js';
import * as oid4vci from './oid4vci.js';
import * as oid4vp from './oid4vp.js';
import * as vcapi from './vcapi.js';
import {ClientInteraction} from './ClientInteraction.js';
export {isInteractionUrl} from './interactions.js';
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
 * Creates a `ClientInteraction` instance from either a CHAPI event or an
 * interaction URL obtained without one (e.g., from a QR code or another
 * exchange). The interaction can be used to fetch protocols, get origin
 * information, or start an exchange by passing the interaction instance to
 * `start()`.
 *
 * @param {object} options - The options to use.
 * @param {object} [options.event] - The CHAPI event.
 * @param {string} [options.interactionUrl] - The interaction URL; the
 *  interaction's origin is the URL's origin. Pass either this or `event`.
 *
 * @returns {Promise<{ClientInteraction}>} - Resolves to a new
 *  ClientInteraction instance.
 */
export async function createClientInteraction({event, interactionUrl} = {}) {
  if(interactionUrl !== undefined) {
    if(event) {
      throw new TypeError(
        'Only one of "event" or "interactionUrl" is allowed.');
    }
    const interaction = new ClientInteraction({
      interactionUrl, getProtocols: _fetchProtocols
    });
    // no other protocols to fall back on, so a failed fetch is an error here
    await interaction.getProtocols();
    return interaction;
  }
  if(!event) {
    throw new TypeError('Either "event" or "interactionUrl" is required.');
  }
  // commonly useful debugging
  if(event?.credential?.dataType === 'VerifiablePresentation' &&
    event.credential.data) {
    const data = event.credential.data;
    console.log('CHAPI: incoming VP: ', prettify(data, null, 2));
  } else if(event?.credentialRequestOptions?.web?.VerifiablePresentation) {
    const vpr = event.credentialRequestOptions.web.VerifiablePresentation;
    console.log('CHAPI: incoming VPR: ', prettify(vpr, null, 2));
  }

  /* Note: Pre-process any event protocols, looking for an `interact` or
  `interaction` protocol URLs first. These are interaction URLs that are used
  to fetch the full protocol list from the coordinator system's `origin` over
  TLS. If available, prefer the protocols retrieved from an interaction URL
  instead of any protocols mentioned in the event's
  `credentialRequestOptions.web.protocols` or
  `credential.options.protocols' values as the former are protected by
  TLS and should not have been erroneously influenced by any browser
  extensions. Using any other protocols in the absence of an interaction URL is
  temporary and for backwards compatibility only. */
  const protocols = event.credentialRequestOptions?.web?.protocols ??
    event.credential?.options?.protocols;
  console.log('Original protocols provided via CHAPI event', protocols);
  const eventInteractionUrl = protocols?.interact ?? protocols?.interaction;
  const interaction = new ClientInteraction({
    interactionUrl: eventInteractionUrl,
    origin: event.credentialRequestOrigin,
    async getProtocols({url}) {
      if(url === null) {
        return protocols ?? {};
      }
      return _fetchProtocols({url});
    }
  });

  try {
    if(eventInteractionUrl) {
      const protocols = await interaction.getProtocols();
      console.log('Protocols fetched from interaction URL', protocols);
    }
  } catch(e) {
    console.log('Failed to fetch interaction protocols', e);
  }

  return interaction;
}

/**
 * Starts a new exchange from the given CHAPI event or `ClientInteraction`. The
 * exchange mechanism to use is auto-selected from the combination of
 * configuration options and offered protocols.
 *
 * @param {object} options - The options to use.
 * @param {object} [options.event] - The CHAPI event.
 * @param {ClientInteraction} [options.interaction] - A `ClientInteraction`.
 *
 * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
 */
export async function start({event, interaction} = {}) {
  if(!(event || interaction)) {
    throw new TypeError('Either "event" or "interaction" is required.');
  }
  interaction = interaction ?? await createClientInteraction({event});

  // get configured accepted protocols in order of preference; try to create
  // an exchange instance for each until one is successful
  const {acceptedProtocols} = config.wallet.exchanges;
  console.log('Accepted protocols in preference order', acceptedProtocols);
  for(const protocol of acceptedProtocols) {
    const create = EXCHANGE_FACTORIES.get(protocol);
    const exchange = await create?.({interaction, event});
    if(exchange) {
      console.log('Selected exchange protocol:', protocol);
      // bind exchange result to CHAPI event and transform it for response
      event?.respondWith(exchange.result.then(result => {
        return exchange.protocol === 'chapi' ? {
          dataType: 'VerifiablePresentation',
          data: result.verifiablePresentation
        } : {
          dataType: 'OutOfBand',
          data: null
        };
      }));
      return exchange;
    }
  }

  // no compatible exchange protocol
  let error;
  if(!event) {
    error = new Error('The interaction is not compatible with this wallet.');
  } else if(event.type === 'credentialstore') {
    error = new Error(
      'The credential offer is not compatible with this wallet.');
  } else {
    error = new Error(
      'The credential request is not compatible with this wallet.');
  }
  throw error;
}

async function _fetchProtocols({url}) {
  console.log('Fetching interaction URL', url);
  // FIXME: fetch via proxy through wallet service instead of directly to
  // improve privacy characteristics
  const response = await httpClient.get(url);
  return response.data?.protocols;
}
