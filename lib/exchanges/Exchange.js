/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
export class Exchange {
  /**
   * Creates a new exchange triggered by a CHAPI event.
   *
   * @param {object} options - The options to use.
   * @param {string} options.protocol - The name of the protocol for this
   *   exchange.
   * @param {object} options.event - The CHAPI event.
   * @param {boolean} options.outOfBand - Whether the exchange occurs out
   *   of band with CHAPI or in band.
   *
   * @returns {Promise<{Exchange}>} - Resolves to a new Exchange instance.
   */
  constructor({protocol, event, outOfBand} = {}) {
    if(typeof protocol !== 'string') {
      throw new TypeError('"protocol" must be a string.');
    }
    if(typeof event !== 'object') {
      throw new TypeError('"event" must be an object.');
    }
    if(typeof outOfBand !== 'boolean') {
      throw new TypeError('"outOfBand" must be a boolean.');
    }

    this.protocol = protocol;

    // store event and bind its response to the new instance
    this._event = event;
    event.respondWith(new Promise((resolve, reject) => {
      this._deferred = {resolve, reject};
    }));
    this.done = false;
    this._result = null;
    this._outOfBand = outOfBand;

    // expose RP origin
    this.credentialRequestOrigin = event.credentialRequestOrigin;
    // expose `store` or `request` (slice `credential` prefix)
    this.type = event.type.slice('credential'.length);
  }

  /**
   * Performs the next step of this exchange. Derived classes are expected to
   * implement any custom behavior for the next step, but should call this
   * super method first to cause an error is thrown if the exchange is already
   * finished.
   *
   * @param {object} options - The options to use.
   *
   * @returns {Promise} - Resolves once the operation completes.
   */
  async next({} = {}) {
    if(!this.done) {
      throw new Error('"next()" must be implemented by a derived class.');
    }
  }

  /**
   * Closes this exchange. If the exchange has not finished, it will be
   * canceled by resolving with a `null` result. To reject the exchange with
   * an error, pass an `Error` instance as `error`.
   *
   * @param {object} options - The options to use.
   * @param {Error} [options.error] - An `Error` to reject the exchange with.
   *
   * @returns {Promise} - Resolves once the operation completes.
   */
  async close({error} = {}) {
    return error ?
      this._deferred.reject(error) :
      this._deferred.resolve(this._result);
  }

  /**
   * Marks this exchange finished. This should be called by derived classes
   * from within `next()` whenever the exchange is determined to be finished.
   *
   * @param {object} options - The options to use.
   * @param {object} [options.verifiablePresentation] - An optional
   *   verifiable presentation to use as the result of the exchange.
   *
   * @returns {object} - Returns `{value: null, done: true}`.
   */
  _finish({verifiablePresentation} = {}) {
    if(this.done) {
      throw new Error('Exchange is already finished.');
    }
    this.done = true;
    this._result = this._outOfBand ? {
      dataType: 'OutOfBand',
      data: null
    } : {
      dataType: 'VerifiablePresentation',
      data: verifiablePresentation
    };
    return {value: null, done: true};
  }
}
