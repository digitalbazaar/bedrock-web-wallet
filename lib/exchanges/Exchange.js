/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc.
 */
export class Exchange {
  /**
   * Creates a new Exchange instance.
   *
   * @param {object} options - The options to use.
   * @param {string} options.protocol - The name of the protocol for this
   *   exchange.
   *
   * @returns {Exchange} - A new Exchange instance.
   */
  constructor({protocol} = {}) {
    // FIXME: accept `interaction` instead
    if(typeof protocol !== 'string') {
      throw new TypeError('"protocol" must be a string.');
    }

    this.protocol = protocol;
    this.done = false;

    this._resolvers = Promise.withResolvers();
    this._result = null;
    this._closed = false;
  }

  /**
   * Performs the next step of this exchange. Derived classes are expected to
   * implement any custom behavior for the next step, but should call this
   * super method first to cause an error is thrown if the exchange is already
   * finished.
   *
   * @returns {Promise} - Resolves once the operation completes.
   */
  async next() {
    if(this.done) {
      throw new Error('Exchange is already finished.');
    }
  }

  /**
   * Directly cancels and closes the exchange.
   */
  cancel() {
    this._result = null;
    this.close();
  }

  /**
   * Closes this exchange. If the exchange has not finished, it will be
   * canceled by resolving with a `null` result. To reject the exchange with
   * an error, pass an `Error` instance as `error`.
   *
   * @param {object} options - The options to use.
   * @param {Error} [options.error] - An `Error` to reject the exchange with.
   */
  close({error} = {}) {
    if(this._closed) {
      throw new Error('Exchange already closed.');
    }
    this.closed = true;
    error ?
      this._resolvers.reject(error) :
      this._resolvers.resolve(this._result);
  }

  /**
   * Marks this exchange finished. This should be called by derived classes
   * from within `next()` whenever the exchange is determined to be finished.
   *
   * @param {object} options - The options to use.
   * @param {object} [options.result] - An optional `result` to use as the
   *   result of the exchange.
   */
  _finish({result} = {}) {
    if(this.done) {
      throw new Error('Exchange is already finished.');
    }
    this.done = true;
    this._result = result;
  }
}
