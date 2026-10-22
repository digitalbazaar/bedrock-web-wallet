/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
/**
 * Runs every exchange an interaction resolves into, in order, and returns the
 * credentials collected along the way.
 *
 * An exchange names a follow-on exchange by finishing with a `redirectUrl`
 * that is an interaction URL: one whose query has `iuv=1`. Any other
 * `redirectUrl` is an ordinary post-exchange landing page and is returned to
 * the caller unfollowed.
 *
 * @param {object} options - Options.
 * @param {string|URL} options.interactionUrl - Where the chain starts.
 * @param {number} [options.maxExchanges=5] - How many exchanges to follow
 *   before refusing to continue.
 * @param {number} [options.maxSteps=20] - How many steps to take within one
 *   exchange before refusing to continue.
 * @param {object} [options.signOptions] - Passed to each `exchange.next()`.
 * @param {Function} [options.onPresentationRequest] - Called when a step asks
 *   for a presentation; must resolve to the presentation to send back, or to
 *   `{verifiablePresentation, signOptions}` when that step's presentation is
 *   to be signed with its own `signOptions`.
 * @param {Function} [options.onLegComplete] - Called after each exchange
 *   finishes and before any follow-on exchange is started.
 * @param {Function} options.createInteraction - Builds an interaction, such
 *   as an `exchanges.ClientInteraction`, from `{interactionUrl}`.
 * @param {Function} options.startExchange - Starts an exchange for
 *   `{interaction}`, such as with `exchanges.start()`.
 *
 * @returns {Promise<object>} `{credentials, exchangeCount, redirectUrl}`.
 */
export async function completeInteractionChain({
  interactionUrl, maxExchanges = 5, maxSteps = 20,
  signOptions, onPresentationRequest, onLegComplete,
  createInteraction, startExchange
} = {}) {
  if(!interactionUrl) {
    throw new TypeError('"interactionUrl" is required.');
  }
  _assertFunction(createInteraction, 'createInteraction');
  _assertFunction(startExchange, 'startExchange');
  _assertSafePositiveInteger(maxExchanges, 'maxExchanges');
  _assertSafePositiveInteger(maxSteps, 'maxSteps');

  const credentials = [];
  let nextUrl = _assertHttps(interactionUrl);
  let exchangeCount = 0;
  let redirectUrl = null;

  while(nextUrl) {
    if(exchangeCount >= maxExchanges) {
      throw new Error(
        `Refusing to follow more than ${maxExchanges} exchanges ` +
        '("maxExchanges").');
    }
    const legUrl = nextUrl;
    /* The origin is the leg's own, self-asserted from the URL the previous
    leg named. Nothing has attested it the way the browser attests a CHAPI
    event's origin, so it is reported to the callbacks rather than trusted
    here: only the caller knows which origins it meant to talk to. */
    const legOrigin = new URL(legUrl).origin;
    const interaction = await createInteraction({interactionUrl: legUrl});
    const exchange = await startExchange({interaction});
    exchangeCount++;

    const before = credentials.length;
    let value;
    let done = false;
    try {
      let options = {signOptions};
      let steps = 0;
      while(!done) {
        /* Bounded because the wallet does not control how many steps an
        exchange takes, and a step that keeps asking for the same thing would
        otherwise hold the holder here indefinitely. */
        if(steps++ >= maxSteps) {
          throw new Error(
            `Refusing to take more than ${maxSteps} steps in one exchange ` +
            '("maxSteps").');
        }
        ({value, done} = await exchange.next(options));
        credentials.push(..._credentialsFrom(value));

        /* A step may ask for a presentation instead of handing one over -- the
        second leg of a chain can open by asking for the credential the first
        leg delivered. Answering is the caller's job, because only it can
        choose and sign with a profile. Skipped once the exchange is over: a
        request on the terminal step would prompt the holder and sign for a
        step that is never sent. */
        options = {signOptions};
        const {verifiablePresentationRequest} = value ?? {};
        if(!done && verifiablePresentationRequest) {
          if(!onPresentationRequest) {
            throw new Error(
              'The exchange asked for a presentation and no ' +
              '"onPresentationRequest" handler was given.');
          }
          const answer = await onPresentationRequest({
            verifiablePresentationRequest,
            credentials: _copy(credentials),
            interactionUrl: legUrl,
            origin: legOrigin
          });
          /* The handler chooses the profile, so only it can build the
          `signOptions` that sign for it; `exchange.next()` signs with them,
          taking `challenge` and `domain` from the request. */
          const {verifiablePresentation, signOptions: answerSignOptions} =
            answer && Object.hasOwn(answer, 'verifiablePresentation') ?
              answer : {verifiablePresentation: answer};
          if(!verifiablePresentation) {
            throw new Error(
              'No presentation was produced for a presentation request.');
          }
          options.verifiablePresentation = verifiablePresentation;
          if(answerSignOptions) {
            options.signOptions = answerSignOptions;
          }
        }
      }
    } catch(error) {
      /* `Exchange.result` only ever settles through `close()`, so an abandoned
      exchange leaves a permanently pending promise and never tells the remote
      server it stopped. */
      await _close({exchange, error});
      throw error;
    }
    await _close({exchange});

    redirectUrl = value?.redirectUrl ?? null;
    nextUrl = _nextInteractionUrl({redirectUrl, base: legUrl});

    /* Deliberately before the next exchange is started: the holder may have to
    be onboarded, and the credential just delivered stored, before the next leg
    can ask them to present it. Handed a copy and the leg's own delta, because
    the running array is pushed to again on every later leg. */
    if(onLegComplete) {
      await onLegComplete({
        credentials: _copy(credentials),
        delta: _copy(credentials.slice(before)),
        interactionUrl: legUrl,
        origin: legOrigin,
        redirectUrl,
        nextInteractionUrl: nextUrl
      });
    }
  }

  return {credentials, exchangeCount, redirectUrl};
}

async function _close({exchange, error}) {
  try {
    await (error ? exchange.close({error}) : exchange.close());
  } catch(e) {
    console.error('Could not close exchange.', e.message);
  }
}

function _assertFunction(value, name) {
  if(typeof value !== 'function') {
    throw new TypeError(`"${name}" must be a function.`);
  }
}

function _assertSafePositiveInteger(value, name) {
  if(!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`"${name}" must be a safe positive integer.`);
  }
}

function _assertHttps(url, base) {
  /* Resolved against the exchange it came from, so a relative follow-on URL
  fails the protocol check rather than `new URL()`'s opaque "Invalid URL". */
  const {protocol, href} = new URL(String(url), base);
  if(protocol !== 'https:') {
    throw new Error(
      `Interaction URL must use "https:", got "${protocol}".`);
  }
  return href;
}

function _nextInteractionUrl({redirectUrl, base}) {
  if(!redirectUrl) {
    return null;
  }
  const url = new URL(String(redirectUrl), base);
  if(url.searchParams.get('iuv') !== '1') {
    return null;
  }
  return _assertHttps(url);
}

function _credentialsFrom(value) {
  const credentials = value?.verifiablePresentation?.verifiableCredential;
  if(!credentials) {
    return [];
  }
  const list = Array.isArray(credentials) ? credentials : [credentials];
  /* Copied on the way in, and again on the way out to a callback. A caller
  that builds a presentation out of what it was handed puts those objects
  through `pruneCredentialProofs()`, which rewrites `credential.proof` in
  place -- so a shared reference would leave the collected credentials with
  their proofs stripped. */
  return _copy(list);
}

function _copy(credentials) {
  return structuredClone(credentials);
}
