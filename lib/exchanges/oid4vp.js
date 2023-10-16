/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import {Exchange} from './Exchange.js';
import {oid4vp} from '@digitalbazaar/oid4-client';
import {profileManager} from '../state.js';

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
   * @param {object} [options.signOptions] - The signing options to use
   *   if the verifiable presentation should be signed before use in the next
   *   step.
   *
   * @returns {Promise} - Resolves once the operation completes.
   */
  async next({signOptions} = {}) {
    super.next();

    // set `did` and `didProofSigner` if `signOptions` is given
    let did;
    let didProofSigner;
    if(signOptions) {
      const {profileId} = signOptions;

      // FIXME: profile signer needs to be selected based on
      // `acceptedProofTypes`, so this needs to be passed into
      // `getProfileSigner`; until then, the signer `type` should be checked
      // against `acceptedProofTypes` and rejected if there's no match
      const {
        invocationSigner: signer
      } = await profileManager.getProfileSigner({profileId});
      did = profileId;
      didProofSigner = signer;
    }

    // do OID4VP exchange
    let result;
    try {
      // FIXME: return authorization request
      // FIXME: copied from OID4VCI, needs updating
      //result = await this._client.requestCredentials({did, didProofSigner});
      console.log('did', did);
      console.log('didProofSigner', didProofSigner);
    } catch(e) {
      if(e.name === 'OperationError' && e.cause?.name === 'NotAllowedError') {
        // FIXME: copied from OID4VCI, needs updating
        // DID authentication is required, create VPR w/ DID Authn requirements
        // requirements
        const nonce = e.cause.cause?.data?.c_nonce;
        const verifiablePresentationRequest = {
          query: {
            type: 'DIDAuthentication',
          },
          challenge: nonce,
          domain: this.offer.credential_issuer
        };
        return {value: {verifiablePresentationRequest}, done: false};
      }
      throw e;
    }

    // FIXME: copied from OID4VCI, needs updating
    // normalize result to a VP
    const credential_responses = result?.credential_responses ??
      (result && [result]);
    const credentials = credential_responses?.map(r => r?.credential);
    const vp = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: credentials
    };

    // exchange is finished
    this._finish({verifiablePresentation: vp});
    return {value: {verifiablePresentation: vp}, done: true};
  }
}

export async function createIfSupported({event} = {}) {
  const url = _getAuthorizationRequestUrl({event});
  if(url) {
    try {
      // get authorization request and convert to VPR
      const {authorizationRequest} = await getAuthorizationRequest({url});
      const {verifiablePresentationRequest} = await oid4vp.toVpr(
        {authorizationRequest});
      return new OID4VPExchange(
        {event, authorizationRequest, verifiablePresentationRequest});
    } catch(e) {
      console.error(
        'Could not create OID4VP exchange from authorization request URL:', e);
    }
  }
  return null;
}

function _getAuthorizationRequestUrl({event} = {}) {
  // get authorization request URL from `protocols`
  const protocols = event.credential?.options?.protocols;
  const url = protocols?.OID4VP ?? protocols?.OID4VP;
  if(!(typeof url === 'string' && url.startsWith('https://'))) {
    console.error(
      'Could not parse HTTPS OID4VP authorization request URL:', url);
  }
  return null;
}
