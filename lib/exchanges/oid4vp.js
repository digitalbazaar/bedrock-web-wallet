/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as presentations from '../presentations.js';
import {Exchange} from './Exchange.js';
import {getDIDAuthenticationOptions} from './util.js';
import {oid4vp} from '@digitalbazaar/oid4-client';

const {getAuthorizationRequest} = oid4vp;

export class OID4VPExchange extends Exchange {
  /**
   * Creates a new exchange for processing a CHAPI event.
   *
   * @param {object} options - The options to use.
   * @param {object} options.event - The CHAPI event.
   * @param {string} options.authorizationRequest - The OID4VP authorization
   *   request.
   * @param {string} options.verifiablePresentationRequest - The VPR produced
   *   from the OID4VP authorization request.
   *
   * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
   */
  constructor({
    event, authorizationRequest, verifiablePresentationRequest
  } = {}) {
    super({protocol: 'OID4VP', event, outOfBand: true});
    this.authorizationRequest = authorizationRequest;
    this.verifiablePresentationRequest = verifiablePresentationRequest;
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

    const {authorizationRequest, verifiablePresentationRequest} = this;

    // no VP given, return VPR
    if(!verifiablePresentation) {
      return {value: {verifiablePresentationRequest}, done: false};
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
      } = getDIDAuthenticationOptions({vpr: verifiablePresentationRequest});
      verifiablePresentation = await presentations.sign({
        challenge, domain, presentation: verifiablePresentation,
        profileId, acceptedProofTypes
      });
    }

    // try to complete the exchange by posting the given VP
    const {result} = await oid4vp.sendAuthorizationResponse({
      verifiablePresentation, authorizationRequest
    });
    const value = {verifiablePresentation: null};
    if(result?.redirect_uri) {
      value.redirectUrl = result.redirect_uri;
    }

    // no error thrown; exchange is finished
    this._finish(value);
    return {value, done: true};
  }
}

export async function createIfSupported({event} = {}) {
  const url = _getAuthorizationRequestUrl({event});
  if(url) {
    try {
      // also returns `fetched` which indicates if it was retrieved and not
      // passed directly; see `requestUrl` for the URL it was fetched from
      // which can be compared against the verifier origin and client_id
      const {authorizationRequest} = await getAuthorizationRequest({url});
      console.log('OID4VP authorization request', authorizationRequest);

      // convert to VPR
      const {verifiablePresentationRequest} = await oid4vp.toVpr(
        {authorizationRequest});
      console.log('OID4VP VPR', verifiablePresentationRequest);
      return new OID4VPExchange(
        {event, authorizationRequest, verifiablePresentationRequest});
    } catch(e) {
      const args =
        ['Could not create OID4VP exchange from authorization request:', e];
      if(e.cause) {
        args.push('\ncause=');
        args.push(e.cause);
      }
      console.error(...args);
    }
  }
  return null;
}

function _getAuthorizationRequestUrl({event} = {}) {
  // get authorization request URL from `protocols`
  const protocols = event.credentialRequestOptions?.web?.protocols ??
    event.credential?.options?.protocols;
  const url = protocols?.OID4VP;
  console.log('oid4vp checking authorization request URL', url);
  if(url) {
    if(typeof url !== 'string') {
      console.error(
        'OID4VP authorization request URL must be a string, url=', url);
      return null;
    }

    // allow `http` or `openid4vp` URLs
    if(url.startsWith('https://') || url.startsWith('openid4vp://')) {
      return url;
    }

    // unrecognized authorization request
    console.error(
      'Unsupported OID4VP authorization request URL protocol, url=', url);
    return null;
  }

  // no OID4VP authorization request
  return null;
}
