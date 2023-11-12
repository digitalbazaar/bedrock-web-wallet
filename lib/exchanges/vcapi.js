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
  'UnmediatedHttpPresentationService2021',
  'VerifiableCredentialApiExchangeService'
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

    // `_vpr` caches current VPR, if present and is not empty
    this._vpr = null;
    if(this.type === 'request') {
      const vpr = event.credentialRequestOptions.web.VerifiablePresentation;
      if(vpr && Object.keys(vpr).length > 0) {
        this._vpr = vpr;
      }
    }
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
      return {value: {verifiablePresentationRequest: this._vpr}, done: false};
    }

    if(verifiablePresentation) {
      // always prune VC proofs
      presentations.pruneCredentialProofs(
        {presentation: verifiablePresentation});

      // sign presentation if `signOptions` is given
      if(signOptions) {
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
    }

    // try to continue the exchange by posting the given VP or an empty
    // payload if none was given
    // FIXME: determine error handling
    const json = verifiablePresentation ? {verifiablePresentation} : undefined;
    const response = await httpClient.post(this._exchangeUrl, {json});
    const {data} = response;
    if(!data.verifiablePresentationRequest) {
      // if nothing else is requested, then exchange is finished
      this._vpr = null;
      let verifiablePresentation = data.verifiablePresentation ?? null;
      if(verifiablePresentation) {
        if(Object.keys(verifiablePresentation).length === 0) {
          verifiablePresentation = null;
        } else {
          validate(
            {type: 'VerifiablePresentation', doc: verifiablePresentation});
        }
      }
      this._finish({verifiablePresentation});
      const value = verifiablePresentation ? {verifiablePresentation} : null;
      return {value, done: true};
    }

    // exchange has more steps, cache VPR in case it is requested again
    this._vpr = data.verifiablePresentationRequest;
    return {value: data, done: false};
  }
}

export async function createIfSupported({event} = {}) {
  const exchangeUrl = _getExchangeUrl({event});
  if(exchangeUrl) {
    // FIXME: blocklist specific fake demo VCAPI exchange URLs
    if(exchangeUrl.includes('fakevpr=') || exchangeUrl.includes('fakevp=')) {
      return null;
    }
    return new VcapiExchange({event, exchangeUrl});
  }
  return null;
}

function _getExchangeUrl({event} = {}) {
  // first try to get exchange URL from `protocols`
  const protocols = event.credentialRequestOptions?.web?.protocols ??
    event.credential?.options?.protocols;
  const exchangeUrl = protocols?.vcapi;
  if(exchangeUrl) {
    return exchangeUrl;
  }

  // next try to get it from `interact` in a VPR
  const services = event.credentialRequestOptions?.web
    .VerifiablePresentation?.interact?.service;
  if(Array.isArray(services)) {
    for(const service of services) {
      const {type, serviceEndpoint} = service;
      if(VCAPI_SERVICE_TYPES.includes(type)) {
        return serviceEndpoint;
      }
    }
  }

  // no exchange URL found
  return null;
}
