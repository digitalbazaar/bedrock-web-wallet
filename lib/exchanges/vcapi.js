/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc.
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
   * Creates a new Exchange that will use the VCALM (VC-API) protocol.
   *
   * @param {object} options - The options to use.
   * @param {string} options.exchangeUrl - The exchange URL to use.
   * @param {object} [options.event] - The CHAPI event, if this exchange was
   *   referenced via CHAPI.
   *
   * @returns {VcapiExchange} - A new VcapiExchange instance.
   */
  constructor({exchangeUrl, event} = {}) {
    super({protocol: 'vcapi'});
    this._exchangeUrl = exchangeUrl;

    // FIXME: remove; do not trust any VPR that wasn't delivered over VCALM

    // `_vpr` caches current VPR, if present and is not empty
    this._vpr = null;
    const vpr = event?.credentialRequestOptions?.web?.VerifiablePresentation;
    if(vpr && Object.keys(vpr).length > 0) {
      this._vpr = vpr;
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
        // get `acceptedCryptosuites`, `domain`, and `challenge` from VPR
        const {profileId} = signOptions;
        const {
          // FIXME: Throw error if challenge not provided
          challenge = 'c0ae1c8e-c7e7-469f-b252-86e6a0e7387e',
          domain,
          acceptedCryptosuites
        } = getDIDAuthenticationOptions({vpr: this._vpr});
        verifiablePresentation = await presentations.sign({
          challenge, domain, presentation: verifiablePresentation,
          profileId, acceptedCryptosuites
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
      this._finish({result: {verifiablePresentation}});
      let value = null;
      if(verifiablePresentation || data.redirectUrl) {
        value = {};
        if(verifiablePresentation) {
          value.verifiablePresentation = verifiablePresentation;
        }
        if(data.redirectUrl) {
          value.redirectUrl = data.redirectUrl;
        }
      }
      return {value, done: true};
    }

    // exchange has more steps, cache VPR in case it is requested again
    this._vpr = data.verifiablePresentationRequest;
    return {value: data, done: false};
  }
}

export async function createIfSupported({interaction, event} = {}) {
  const exchangeUrl = await _getExchangeUrl({interaction, event});
  if(exchangeUrl) {
    // FIXME: blocklist specific fake demo VCAPI exchange URLs
    if(exchangeUrl.includes('fakevpr=') || exchangeUrl.includes('fakevp=')) {
      return null;
    }
    return new VcapiExchange({event, exchangeUrl});
  }
  return null;
}

async function _getExchangeUrl({interaction, event} = {}) {
  // first try to get exchange URL from protocols
  const protocols = await interaction.getProtocols();
  const exchangeUrl = protocols?.vcapi;
  if(exchangeUrl) {
    return exchangeUrl;
  }

  // next try to get it from `interact` in a VPR
  const services = event?.credentialRequestOptions?.web
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
