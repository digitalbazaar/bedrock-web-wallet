/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc.
 */
import {Exchange} from './Exchange.js';

export class ChapiExchange extends Exchange {
  /**
   * Creates a new Exchange triggered by a CHAPI event.
   *
   * @param {object} options - The options to use.
   * @param {string} options.protocol - The name of the protocol for this
   *   exchange.
   * @param {object} options.event - The CHAPI event.
   * @param {boolean} options.outOfBand - Whether the exchange occurs out
   *   of band with CHAPI or in band.
   *
   * @returns {ChapiExchange} - A new ChapiExchange instance.
   */
  constructor({protocol, event, outOfBand} = {}) {
    super({protocol});

    if(typeof event !== 'object') {
      throw new TypeError('"event" must be an object.');
    }
    if(typeof outOfBand !== 'boolean') {
      throw new TypeError('"outOfBand" must be a boolean.');
    }

    // store event and out-of-band status
    this._event = event;
    this._outOfBand = outOfBand;

    // expose RP origin
    this.credentialRequestOrigin = event.credentialRequestOrigin;
    // expose `store` or `request` (slice `credential` prefix)
    this.type = event.type.slice('credential'.length);
  }
}
