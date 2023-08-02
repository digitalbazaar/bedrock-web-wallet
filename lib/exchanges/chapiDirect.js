/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as presentations from '../presentations.js';
import {Exchange} from './Exchange.js';
import {getDIDAuthenticationOptions} from './util.js';
import {validate} from '../validator.js';

export class ChapiDirectExchange extends Exchange {
  /**
   * Creates a new exchange for processing a CHAPI event.
   *
   * @param {object} options - The options to use.
   * @param {object} options.event - The CHAPI event.
   *
   * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
   */
  constructor({event} = {}) {
    super({protocol: 'chapi', event, outOfBand: false});
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

    // if a `verifiablePresentation` is given, finish exchange with it
    if(verifiablePresentation) {
      // sign presentation if `signOptions` is given
      if(signOptions) {
        // get `acceptedProofTypes`, `domain`, and `challenge` from VPR
        const vpr = this._event.credentialRequestOptions?.web
          .VerifiablePresentation;
        const {
          // FIXME: Throw error if challenge not provided
          challenge = 'c0ae1c8e-c7e7-469f-b252-86e6a0e7387e',
          domain,
          acceptedProofTypes
        } = getDIDAuthenticationOptions({vpr});
        const {profileId} = signOptions;
        verifiablePresentation = await presentations.sign({
          challenge, domain, presentation: verifiablePresentation,
          profileId, acceptedProofTypes
        });
      }
      this._finish({verifiablePresentation});
      return {value: null, done: true};
    }

    // no `verifiablePresentation` given, this is the first step; return either
    // the VPR or the VP from the event
    if(this.type === 'store') {
      // CHAPI direct storage exchange is single step and then finished
      const verifiablePresentation = this._event.credential.data;
      this._finish({verifiablePresentation});
      return {value: {verifiablePresentation}, done: true};
    }
    return {
      value: {
        verifiablePresentationRequest:
          this._event.credentialRequestOptions.web.VerifiablePresentation
      },
      done: false
    };
  }
}

export async function createIfSupported({event} = {}) {
  const data = event?.credentialRequestOptions?.web?.VerifiablePresentation ??
    (event?.credential?.dataType === 'VerifiablePresentation' &&
      event.credential.data);
  if(!data) {
    // neither VP nor VPR directly provided; so CHAPI direct is not supported
    return null;
  }

  // ensure VP is valid or else CHAPI direct is not supported
  if(event.type === 'credentialstore') {
    try {
      validate({type: 'VerifiablePresentation', doc: data});
    } catch(e) {
      console.error('Could not parse Verifiable Presentation:', e);
      return null;
    }
  }

  // FIXME: also validate VPR in the same manner

  return new ChapiDirectExchange({event});
}
