/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {describe, expect, it} from 'vitest';
import {
  completeInteractionChain
} from '../../lib/exchanges/interactionChain.js';

const FIRST_URL = 'https://first.example/exchanges/1';
const SECOND_URL = 'https://second.example/exchanges/2';

const FIRST_VC = {
  type: ['VerifiableCredential', 'ExampleCredential'],
  credentialSubject: {id: 'urn:uuid:first'}
};
const SECOND_VC = {
  type: ['VerifiableCredential', 'SecondExampleCredential'],
  credentialSubject: {id: 'urn:uuid:second'}
};

// each entry is one `{value, done}` the exchange hands back, in order
function exchangeReturning(steps) {
  let index = 0;
  const calls = [];
  const exchange = {
    calls,
    closed: null,
    async next(options) {
      calls.push(options);
      if(index >= steps.length) {
        throw new Error('exchange stepped past the end of its script');
      }
      return steps[index++];
    },
    async close(options) {
      exchange.closed = options ?? {};
    }
  };
  return exchange;
}

function presentationOf(...credentials) {
  return {verifiablePresentation: {verifiableCredential: credentials}};
}

// records which URLs the chain visited, and serves a scripted exchange per URL
function harness(scriptsByUrl) {
  const visited = [];
  const exchanges = [];
  return {
    visited,
    exchanges,
    createInteraction({interactionUrl}) {
      visited.push(String(interactionUrl));
      return {interactionUrl: String(interactionUrl)};
    },
    startExchange({interaction}) {
      const steps = scriptsByUrl[interaction.interactionUrl];
      if(!steps) {
        throw new Error(`no script for "${interaction.interactionUrl}"`);
      }
      const exchange = exchangeReturning(steps);
      exchanges.push(exchange);
      return exchange;
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(r => resolve = r);
  return {promise, resolve};
}

describe('completeInteractionChain', () => {
  it('collects a credential from a single exchange', async () => {
    const h = harness({
      [FIRST_URL]: [{value: presentationOf(FIRST_VC), done: true}]
    });
    const result = await completeInteractionChain({
      interactionUrl: FIRST_URL, ...h
    });
    expect(h.visited).toEqual([FIRST_URL]);
    expect(result.credentials).toEqual([FIRST_VC]);
    expect(result.exchangeCount).toBe(1);
  });

  it('accepts a credential that is not wrapped in an array', async () => {
    const h = harness({
      [FIRST_URL]: [{
        value: {verifiablePresentation: {verifiableCredential: FIRST_VC}},
        done: true
      }]
    });
    const result = await completeInteractionChain({
      interactionUrl: FIRST_URL, ...h
    });
    expect(result.credentials).toEqual([FIRST_VC]);
  });

  it('keeps stepping one exchange until it reports done', async () => {
    const h = harness({
      [FIRST_URL]: [
        {value: {}, done: false},
        {value: presentationOf(FIRST_VC), done: false},
        {value: {}, done: true}
      ]
    });
    const result = await completeInteractionChain({
      interactionUrl: FIRST_URL, ...h
    });
    // every scripted step is consumed, including the terminal one
    expect(h.exchanges[0].calls).toHaveLength(3);
    expect(result.credentials).toEqual([FIRST_VC]);
  });

  it('closes each exchange once it is done', async () => {
    const h = harness({
      [FIRST_URL]: [{value: presentationOf(FIRST_VC), done: true}]
    });
    await completeInteractionChain({interactionUrl: FIRST_URL, ...h});
    expect(h.exchanges[0].closed).toEqual({});
  });

  it('closes the exchange with the error when a step throws', async () => {
    const boom = new Error('step failed');
    const h = harness({[FIRST_URL]: []});
    h.startExchange = () => ({
      calls: [],
      closed: null,
      async next() {
        throw boom;
      },
      async close(options) {
        this.closed = options ?? {};
      }
    });
    const exchanges = [];
    const startExchange = args => {
      const e = h.startExchange(args);
      exchanges.push(e);
      return e;
    };
    await expect(completeInteractionChain({
      interactionUrl: FIRST_URL,
      createInteraction: h.createInteraction,
      startExchange
    })).rejects.toThrow('step failed');
    expect(exchanges[0].closed).toEqual({error: boom});
  });

  describe('chaining', () => {
    it('follows `nextInteractionUrl` to the next exchange', async () => {
      const h = harness({
        [FIRST_URL]: [{
          value: {
            ...presentationOf(FIRST_VC), nextInteractionUrl: SECOND_URL
          },
          done: true
        }],
        [SECOND_URL]: [{value: presentationOf(SECOND_VC), done: true}]
      });
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...h
      });
      expect(h.visited).toEqual([FIRST_URL, SECOND_URL]);
      expect(result.credentials).toEqual([FIRST_VC, SECOND_VC]);
      expect(result.exchangeCount).toBe(2);
    });

    it('does NOT treat `redirectUrl` as the next exchange', async () => {
      const h = harness({
        [FIRST_URL]: [{
          value: {...presentationOf(FIRST_VC), redirectUrl: SECOND_URL},
          done: true
        }],
        [SECOND_URL]: [{value: presentationOf(SECOND_VC), done: true}]
      });
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...h
      });
      // the protocols' own post-exchange redirect is reported, not followed
      expect(h.visited).toEqual([FIRST_URL]);
      expect(result.credentials).toEqual([FIRST_VC]);
      expect(result.redirectUrl).toBe(SECOND_URL);
    });

    it('follows `redirectUrl` when the caller opts in', async () => {
      const h = harness({
        [FIRST_URL]: [{
          value: {...presentationOf(FIRST_VC), redirectUrl: SECOND_URL},
          done: true
        }],
        [SECOND_URL]: [{value: presentationOf(SECOND_VC), done: true}]
      });
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, followRedirectUrl: true, ...h
      });
      expect(h.visited).toEqual([FIRST_URL, SECOND_URL]);
      expect(result.credentials).toEqual([FIRST_VC, SECOND_VC]);
    });

    it('resolves a relative follow-on URL against the leg it came from',
      async () => {
        const h = harness({
          [FIRST_URL]: [{
            value: {nextInteractionUrl: '/exchanges/9'}, done: true
          }],
          'https://first.example/exchanges/9': [
            {value: presentationOf(SECOND_VC), done: true}
          ]
        });
        const result = await completeInteractionChain({
          interactionUrl: FIRST_URL, ...h
        });
        expect(h.visited).toEqual([
          FIRST_URL, 'https://first.example/exchanges/9'
        ]);
        expect(result.credentials).toEqual([SECOND_VC]);
      });

    it('refuses a follow-on URL that is not https', async () => {
      const h = harness({
        [FIRST_URL]: [{
          value: {nextInteractionUrl: 'http://second.example/exchanges/2'},
          done: true
        }]
      });
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL, ...h
      })).rejects.toThrow(/https/i);
    });

    it('refuses a starting URL that is not https', async () => {
      await expect(completeInteractionChain({
        interactionUrl: 'http://first.example/exchanges/1',
        ...harness({})
      })).rejects.toThrow(/https/i);
    });

    it('requires an interaction URL', async () => {
      await expect(completeInteractionChain({...harness({})}))
        .rejects.toThrow(/interactionUrl/);
    });
  });

  describe('bounds', () => {
    it('stops after `maxExchanges` and takes exactly that many', async () => {
      // an exchange that always names another one
      const h = {
        visited: [],
        createInteraction({interactionUrl}) {
          h.visited.push(String(interactionUrl));
          return {interactionUrl: String(interactionUrl)};
        },
        startExchange() {
          return exchangeReturning([
            {value: {nextInteractionUrl: FIRST_URL}, done: true}
          ]);
        }
      };
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL, maxExchanges: 3,
        createInteraction: h.createInteraction,
        startExchange: h.startExchange
      })).rejects.toThrow(/maxExchanges/);
      expect(h.visited).toHaveLength(3);
    });

    it('stops after `maxSteps` and takes exactly that many', async () => {
      const h = harness({
        // never reports done
        [FIRST_URL]: Array.from({length: 50}, () => ({value: {}, done: false}))
      });
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL, maxSteps: 4, ...h
      })).rejects.toThrow(/maxSteps/);
      expect(h.exchanges[0].calls).toHaveLength(4);
    });

    it.each([
      ['maxExchanges', {maxExchanges: 0}],
      ['maxExchanges', {maxExchanges: 1.5}],
      ['maxExchanges', {maxExchanges: 2 ** 54}],
      ['maxSteps', {maxSteps: 0}],
      ['maxSteps', {maxSteps: 2 ** 54}]
    ])('refuses an unusable %s bound', async (name, bound) => {
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL, ...bound, ...harness({})
      })).rejects.toThrow(new RegExp(name));
    });
  });

  describe('signOptions', () => {
    it('passes them to every step of every exchange', async () => {
      const signOptions = {suite: 'test-suite'};
      const h = harness({
        [FIRST_URL]: [
          {value: {}, done: false},
          {value: {nextInteractionUrl: SECOND_URL}, done: true}
        ],
        [SECOND_URL]: [
          {value: {}, done: false},
          {value: presentationOf(SECOND_VC), done: true}
        ]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL, signOptions, ...h
      });
      const seen = h.exchanges.flatMap(e => e.calls);
      expect(seen).toHaveLength(4);
      for(const call of seen) {
        expect(call.signOptions).toBe(signOptions);
      }
    });
  });

  describe('presentation requests', () => {
    const VPR = {query: [{type: 'QueryByExample'}]};

    it('hands the handler the request, origin and leg URL', async () => {
      const seen = [];
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: presentationOf(FIRST_VC), done: true}
        ]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL,
        onPresentationRequest(args) {
          seen.push(args);
          return {type: 'VerifiablePresentation'};
        },
        ...h
      });
      expect(seen).toHaveLength(1);
      expect(seen[0].verifiablePresentationRequest).toBe(VPR);
      expect(seen[0].interactionUrl).toBe(FIRST_URL);
      expect(seen[0].origin).toBe('https://first.example');
    });

    it('sends the presentation back on the following step', async () => {
      const presentation = {type: 'VerifiablePresentation'};
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: presentationOf(FIRST_VC), done: true}
        ]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL,
        onPresentationRequest: () => presentation,
        ...h
      });
      const [first, second] = h.exchanges[0].calls;
      expect(first.verifiablePresentation).toBeUndefined();
      expect(second.verifiablePresentation).toBe(presentation);
    });

    it('signs with the signOptions the handler answers with', async () => {
      const presentation = {
        type: 'VerifiablePresentation', holder: 'did:key:z6MkHolder'
      };
      const answerSignOptions = {suite: 'holder-suite'};
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: presentationOf(FIRST_VC), done: true}
        ]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL,
        onPresentationRequest: () => ({
          verifiablePresentation: presentation, signOptions: answerSignOptions
        }),
        ...h
      });
      const [first, second] = h.exchanges[0].calls;
      expect(first.signOptions).toBeUndefined();
      expect(second.verifiablePresentation).toBe(presentation);
      expect(second.signOptions).toBe(answerSignOptions);
    });

    it('uses the answer\'s signOptions for that step only', async () => {
      const chainSignOptions = {suite: 'chain-suite'};
      const answerSignOptions = {suite: 'holder-suite'};
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: {}, done: false},
          {value: presentationOf(FIRST_VC), done: true}
        ]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL, signOptions: chainSignOptions,
        onPresentationRequest: () => ({
          verifiablePresentation: {type: 'VerifiablePresentation'},
          signOptions: answerSignOptions
        }),
        ...h
      });
      expect(h.exchanges[0].calls.map(call => call.signOptions)).toEqual(
        [chainSignOptions, answerSignOptions, chainSignOptions]);
    });

    it('refuses an answer that names no presentation', async () => {
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false}
        ]
      });
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL,
        onPresentationRequest: () => ({
          verifiablePresentation: undefined, signOptions: {suite: 'x'}
        }),
        ...h
      })).rejects.toThrow(/No presentation was produced/);
    });

    it('ignores a request on the terminal step', async () => {
      let called = false;
      const h = harness({
        [FIRST_URL]: [{
          value: {
            ...presentationOf(FIRST_VC), verifiablePresentationRequest: VPR
          },
          done: true
        }]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL,
        onPresentationRequest() {
          called = true;
          return {};
        },
        ...h
      });
      expect(called).toBe(false);
    });

    it('refuses a request with no handler', async () => {
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false}
        ]
      });
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL, ...h
      })).rejects.toThrow(/onPresentationRequest/);
    });

    it('refuses a handler that produces nothing', async () => {
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false}
        ]
      });
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL,
        onPresentationRequest: () => undefined,
        ...h
      })).rejects.toThrow(/No presentation was produced/);
    });
  });

  it('gives callbacks credentials a callee cannot mutate', async () => {
    const VPR = {query: [{type: 'QueryByExample'}]};
    const h = harness({
      [FIRST_URL]: [
        {value: presentationOf(FIRST_VC), done: false},
        {value: {verifiablePresentationRequest: VPR}, done: false},
        {value: {}, done: true}
      ]
    });
    const result = await completeInteractionChain({
      interactionUrl: FIRST_URL,
      onPresentationRequest({credentials}) {
        /* What a real handler does: builds a presentation out of what it was
        handed, which puts those credentials through proof pruning -- and that
        rewrites `credential.proof` in place. */
        for(const credential of credentials) {
          credential.proof = [];
          credential.credentialSubject.id = 'urn:uuid:tampered';
        }
        return {type: 'VerifiablePresentation'};
      },
      ...h
    });
    expect(result.credentials).toEqual([FIRST_VC]);
    expect(result.credentials[0].proof).toBeUndefined();
    expect(result.credentials[0].credentialSubject.id).toBe('urn:uuid:first');
  });

  describe('onLegComplete', () => {
    it('runs between legs, before the next one is started', async () => {
      const gate = deferred();
      const order = [];
      const scripts = {
        [FIRST_URL]: [{
          value: {
            ...presentationOf(FIRST_VC), nextInteractionUrl: SECOND_URL
          },
          done: true
        }],
        [SECOND_URL]: [{value: presentationOf(SECOND_VC), done: true}]
      };
      const run = completeInteractionChain({
        interactionUrl: FIRST_URL,
        createInteraction({interactionUrl}) {
          order.push(`visit:${interactionUrl}`);
          return {interactionUrl: String(interactionUrl)};
        },
        startExchange({interaction}) {
          return exchangeReturning(scripts[interaction.interactionUrl]);
        },
        async onLegComplete({nextInteractionUrl}) {
          if(!nextInteractionUrl) {
            return;
          }
          order.push('leg:blocked');
          await gate.promise;
          order.push('leg:released');
        }
      });
      /* Released only after the event loop has had every chance to run the
      chain ahead of the callback. The ordering below is what fails if the
      callback is invoked without being awaited. */
      await new Promise(r => setTimeout(r, 0));
      gate.resolve();
      await run;
      expect(order).toEqual([
        `visit:${FIRST_URL}`, 'leg:blocked', 'leg:released',
        `visit:${SECOND_URL}`
      ]);
    });

    it('reports each leg\'s own delta and a copy of the running set',
      async () => {
        const legs = [];
        const h = harness({
          [FIRST_URL]: [{
            value: {
              ...presentationOf(FIRST_VC), nextInteractionUrl: SECOND_URL
            },
            done: true
          }],
          [SECOND_URL]: [{value: presentationOf(SECOND_VC), done: true}]
        });
        const result = await completeInteractionChain({
          interactionUrl: FIRST_URL,
          onLegComplete(leg) {
            // retained deliberately: a consumer that keeps the reference
            // must not see it grow underneath
            legs.push(leg);
            leg.credentials.push('mutated');
          },
          ...h
        });
        expect(legs).toHaveLength(2);
        expect(legs[0].delta).toEqual([FIRST_VC]);
        expect(legs[0].interactionUrl).toBe(FIRST_URL);
        expect(legs[0].nextInteractionUrl).toBe(SECOND_URL);
        expect(legs[1].delta).toEqual([SECOND_VC]);
        expect(legs[1].nextInteractionUrl).toBe(null);
        // the first leg's array never grew past what it was handed
        expect(legs[0].credentials).toEqual([FIRST_VC, 'mutated']);
        expect(result.credentials).toEqual([FIRST_VC, SECOND_VC]);
      });
  });
});
