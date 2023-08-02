/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import {OID4Client, parseCredentialOfferUrl} from '@digitalbazaar/oid4-client';
import {Exchange} from './Exchange.js';
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

    // do OID4VCI exchange
    const result = await this._client.requestCredentials({did, didProofSigner});

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
    return {value: vp, done: true};
  }
}

export async function createIfSupported({event} = {}) {
  const offer = _getCredentialOffer({event});
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

function _getCredentialOffer({event} = {}) {
  // get credential offer URL from `protocols`
  const protocols = event.credential?.protocols;
  const url = protocols?.OID4VCI ?? protocols?.OID4VC;
  if(url) {
    try {
      return parseCredentialOfferUrl({url});
    } catch(e) {
      console.error('Could not parse OID4VCI credential offer URL:', e);
    }
  }
  return null;
}
