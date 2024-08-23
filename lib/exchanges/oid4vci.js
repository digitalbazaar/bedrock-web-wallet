/*!
 * Copyright (c) 2023-2024 Digital Bazaar, Inc. All rights reserved.
 */
import * as presentations from '../presentations.js';
import {
  getCredentialOffer, OID4Client, oid4vp
} from '@digitalbazaar/oid4-client';
import {Exchange} from './Exchange.js';
import {getDIDAuthenticationOptions} from './util.js';
import {profileManager} from '../state.js';

export class OID4VCIExchange extends Exchange {
  /**
   * Creates a new exchange for processing a CHAPI event.
   *
   * @param {object} options - The options to use.
   * @param {object} options.event - The CHAPI event.
   * @param {object} options.offer - The credential offer use.
   * @param {object} options.client - The OID4Client to use.
   *
   * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
   */
  constructor({event, offer, client} = {}) {
    super({protocol: 'OID4VCI', event, outOfBand: true});
    this.offer = offer;
    this._client = client;
    // stores OID4VP information if a presentation is required
    this._oid4vp = null;
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

    // `did` and `didProofSigner` will be set if `signOptions` is given and
    // no `verifiablePresentation` is given
    let did;
    let didProofSigner;

    // sign presentation or DID proof if `signOptions` is given
    if(signOptions) {
      const {profileId} = signOptions;

      // perform OID4VP...
      if(verifiablePresentation && this._oid4vp) {
        // always prune VC proofs
        presentations.pruneCredentialProofs(
          {presentation: verifiablePresentation});

        const {authorizationRequest, vpr} = this._oid4vp;

        // get `acceptedProofTypes`, `domain`, and `challenge` from VPR
        const {
          // FIXME: Throw error if challenge not provided
          challenge = 'c0ae1c8e-c7e7-469f-b252-86e6a0e7387e',
          domain,
          acceptedProofTypes
        } = getDIDAuthenticationOptions({vpr});
        verifiablePresentation = await presentations.sign({
          challenge, domain, presentation: verifiablePresentation,
          profileId, acceptedProofTypes
        });
        // send OID4VP authorization response
        const {
          result, presentationSubmission
        } = await oid4vp.sendAuthorizationResponse({
          verifiablePresentation, authorizationRequest
        });
        this._oid4vp.result = result;
        this._oid4vp.presentationSubmission = presentationSubmission;
        // result successful, fall through to finish with OID4VCI...
      } else {
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
    }

    // do OID4VCI exchange
    let result;
    try {
      result = await this._client.requestCredentials({did, didProofSigner});
    } catch(e) {
      if(e.name === 'OperationError' && e.cause?.name === 'NotAllowedError') {
        const {cause: {cause: {data}}} = e;
        const {error} = data;

        // presentation required via OID4VP
        if(error === 'presentation_required') {
          // create VPR from OID4VP authorization request
          const {authorization_request: authorizationRequest} = data;
          const {verifiablePresentationRequest} = await oid4vp.toVpr({
            authorizationRequest
          });
          this._oid4vp = {
            authorizationRequest,
            vpr: verifiablePresentationRequest
          };
          return {value: {verifiablePresentationRequest}, done: false};
        }

        // DID authentication is required via OID4VCI
        if(error === 'invalid_proof' || error === 'invalid_or_missing_proof') {
          // create VPR w/ DID Authn requirements
          const {c_nonce: nonce} = data;
          const verifiablePresentationRequest = {
            query: {
              type: 'DIDAuthentication',
            },
            challenge: nonce,
            domain: this.offer.credential_issuer
          };
          return {value: {verifiablePresentationRequest}, done: false};
        }
      }
      throw e;
    }

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
  const offer = await _getCredentialOffer({event});
  if(offer) {
    try {
      const client = await OID4Client.fromCredentialOffer({offer});
      return new OID4VCIExchange({event, offer, client});
    } catch(e) {
      console.error('Could not create OID4VCI client from offer URL:', e);
    }
  }
  return null;
}

async function _getCredentialOffer({event} = {}) {
  // get credential offer URL from `protocols`
  const protocols = event.credential?.options?.protocols;
  const url = protocols?.OID4VCI ?? protocols?.OID4VC;
  if(url) {
    try {
      return getCredentialOffer({url});
    } catch(e) {
      console.error('Could not get OID4VCI credential offer:', e);
    }
  }
  return null;
}
