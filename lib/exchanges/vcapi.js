/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as presentations from '../presentations.js';
import {Exchange} from './Exchange.js';
import {getDIDAuthenticationOptions} from './util.js';
import {httpClient} from '@digitalbazaar/http-client';
import {validate} from '../validator.js';

const VCAPI_SERVICE_TYPES = [
  'UnmediatedPresentationService2021',
  'UnmediatedHttpPresentationService2021'
];

export class VcapiExchange extends Exchange {
  /**
   * Creates a new exchange for processing a CHAPI event.
   *
   * @param {object} options - The options to use.
   * @param {object} options.event - The CHAPI event.
   * @param {string} options.exchangeUrl - The exchange URL to use.
   *
   * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
   */
  constructor({event, exchangeUrl} = {}) {
    super({protocol: 'vcapi', event, outOfBand: true});
    this._exchangeUrl = exchangeUrl;

    // `_vpr` caches current VPR
    this._vpr = this.type === 'request' ?
      event.credentialRequestOptions.web.VerifiablePresentation : null;
  }

  /**
   * Performs the next step of this exchange.
   *
   * @param {object} options - The options to use.
   * @param {object} [options.verifiablePresentation] - The verifiable
   *   presentation to use in the next step.
   * @param {object} [options.signOptions] - The signing options to use
   *   if the verifiable presentation should be signed before use in the next
   *   step.
   *
   * @returns {Promise} - Resolves once the operation completes.
   */
  async next({verifiablePresentation, signOptions} = {}) {
    super.next();

    // no VP given and there's a cached VPR, return it
    if(!verifiablePresentation && this._vpr) {
      return {
        value: {
          verifiablePresentationRequest: this._vpr
        },
        done: false
      };
    }

    // sign presentation if `signOptions` is given
    if(verifiablePresentation && signOptions) {
      // get `acceptedProofTypes`, `domain`, and `challenge` from VPR
      const {profileId} = signOptions;
      const {
        // FIXME: Throw error if challenge not provided
        challenge = 'c0ae1c8e-c7e7-469f-b252-86e6a0e7387e',
        domain,
        acceptedProofTypes
      } = getDIDAuthenticationOptions({vpr: this._vpr});
      verifiablePresentation = await presentations.sign({
        challenge, domain, presentation: verifiablePresentation,
        profileId, acceptedProofTypes
      });
    }

    // try to continue the exchange by posting the given VP or an empty
    // payload if none was given
    // FIXME: determine error handling
    const json = verifiablePresentation ? {verifiablePresentation} : undefined;
    const response = await httpClient.post({url: this._exchangeUrl, json});
    const {data} = response;
    if(!data.verifiablePresentationRequest) {
      // if nothing else is requested, then exchange is finished
      this._vpr = null;
      const verifiablePresentation = data.verifiablePresentation ?? null;
      validate({type: 'VerifiablePresentation', doc: verifiablePresentation});
      return this._finish({
        verifiablePresentation: data.verifiablePresentation ?? null
      });
    }

    // exchange has more steps, cache VPR in case it is requested again
    this._vpr = data.verifiablePresentationRequest;
    return {value: data, done: false};
  }
}

export async function createIfSupported({event} = {}) {
  const exchangeUrl = _getExchangeUrl({event});
  if(exchangeUrl) {
    return new VcapiExchange({event});
  }
  return null;
}

function _getExchangeUrl({event} = {}) {
  // first try to get exchange URL from `protocols`
  const {web: webOptions} = event.credentialRequestOptions;
  const exchangeUrl = webOptions.protocols?.vcapi;
  if(exchangeUrl) {
    return exchangeUrl;
  }

  // next try to get it from `interact` in a VPR
  const services = webOptions.VerifiablePresentation?.interact?.service;
  for(const service of services) {
    const {type, serviceEndpoint} = service;
    if(VCAPI_SERVICE_TYPES.includes(type)) {
      return serviceEndpoint;
    }
  }

  // no exchange URL found
  return null;
}
