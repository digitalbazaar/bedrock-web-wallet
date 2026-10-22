/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {describe, expect, it} from 'vitest';
import {
  completeInteractionChain
} from '../../lib/exchanges/interactionChain.js';

const FIRST_URL = 'https://first.example/exchanges/1';
const SECOND_URL = 'https://second.example/interactions/2?iuv=1';
const LANDING_URL = 'https://second.example/done';

const VPR = {query: [{type: 'QueryByExample'}]};
const ANSWER = {type: 'VerifiablePresentation'};

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
    },
    onBeforeContinue: () => true
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
        {value: {verifiablePresentationRequest: VPR}, done: false},
        {
          value: {
            ...presentationOf(FIRST_VC), verifiablePresentationRequest: VPR
          },
          done: false
        },
        {value: {}, done: true}
      ]
    });
    const result = await completeInteractionChain({
      interactionUrl: FIRST_URL, onPresentationRequest: () => ANSWER, ...h
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
      startExchange,
      onBeforeContinue: h.onBeforeContinue
    })).rejects.toThrow('step failed');
    expect(exchanges[0].closed).toEqual({error: boom});
  });

  it('refuses a step that neither finishes nor asks for a presentation',
    async () => {
      const h = harness({
        [FIRST_URL]: [
          {value: presentationOf(FIRST_VC), done: false},
          {value: presentationOf(FIRST_VC), done: true}
        ]
      });
      await expect(completeInteractionChain({
        interactionUrl: FIRST_URL, onPresentationRequest: () => ANSWER, ...h
      })).rejects.toThrow(/neither finished nor asked for a presentation/);
      expect(h.exchanges[0].calls).toHaveLength(1);
      expect(h.exchanges[0].closed.error).toBeInstanceOf(Error);
    });

  describe('chaining', () => {
    it('follows a `redirectUrl` that is an interaction URL', async () => {
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
      expect(h.visited).toEqual([FIRST_URL, SECOND_URL]);
      expect(result.credentials).toEqual([FIRST_VC, SECOND_VC]);
      expect(result.exchangeCount).toBe(2);
      expect(result.redirectUrl).toBe(null);
    });

    it.each([
      ['has no `iuv`', LANDING_URL],
      ['has `iuv` other than 1', 'https://second.example/interactions/2?iuv=2'],
      ['has `iuv=1` only in its fragment',
        'https://second.example/interactions/2#iuv=1'],
      ['is not https', 'http://second.example/done']
    ])('returns a `redirectUrl` that %s unfollowed', async (_, redirectUrl) => {
      const h = harness({
        [FIRST_URL]: [{
          value: {...presentationOf(FIRST_VC), redirectUrl},
          done: true
        }]
      });
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...h
      });
      expect(h.visited).toEqual([FIRST_URL]);
      expect(result.credentials).toEqual([FIRST_VC]);
      expect(result.redirectUrl).toBe(redirectUrl);
    });

    it('does not follow `nextInteractionUrl`', async () => {
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
      expect(h.visited).toEqual([FIRST_URL]);
      expect(result.credentials).toEqual([FIRST_VC]);
    });

    it('resolves a relative follow-on URL against the leg it came from',
      async () => {
        const h = harness({
          [FIRST_URL]: [{
            value: {redirectUrl: '/interactions/9?iuv=1'}, done: true
          }],
          'https://first.example/interactions/9?iuv=1': [
            {value: presentationOf(SECOND_VC), done: true}
          ]
        });
        const result = await completeInteractionChain({
          interactionUrl: FIRST_URL, ...h
        });
        expect(h.visited).toEqual([
          FIRST_URL, 'https://first.example/interactions/9?iuv=1'
        ]);
        expect(result.credentials).toEqual([SECOND_VC]);
      });

    it('refuses an interaction URL redirect that is not https', async () => {
      const h = harness({
        [FIRST_URL]: [{
          value: {redirectUrl: 'http://second.example/interactions/2?iuv=1'},
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

    it.each(['createInteraction', 'startExchange', 'onBeforeContinue'])(
      'requires the caller to supply `%s`', async name => {
        const h = harness({
          [FIRST_URL]: [{value: presentationOf(FIRST_VC), done: true}]
        });
        delete h[name];
        await expect(completeInteractionChain({
          interactionUrl: FIRST_URL, ...h
        })).rejects.toThrow(new RegExp(`"${name}" must be a function`));
        expect(h.exchanges).toHaveLength(0);
      });
  });

  describe('onBeforeContinue', () => {
    const CHAINED = {
      [FIRST_URL]: [{
        value: {...presentationOf(FIRST_VC), redirectUrl: SECOND_URL},
        done: true
      }],
      [SECOND_URL]: [{value: presentationOf(SECOND_VC), done: true}]
    };

    it('is asked before each follow-on exchange, not the first', async () => {
      const seen = [];
      const h = harness(CHAINED);
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...h,
        onBeforeContinue(args) {
          seen.push({visited: [...h.visited], ...args});
          return true;
        }
      });
      expect(seen).toEqual([{
        visited: [FIRST_URL],
        interactionUrl: SECOND_URL,
        origin: 'https://second.example',
        exchangeCount: 1,
        credentials: [FIRST_VC]
      }]);
      expect(result.canceled).toBe(false);
    });

    it.each([
      ['false', () => false],
      ['a promise of false', async () => false],
      ['nothing', () => undefined]
    ])('stops the chain when it answers %s', async (_, onBeforeContinue) => {
      const h = harness(CHAINED);
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...h, onBeforeContinue
      });
      expect(h.visited).toEqual([FIRST_URL]);
      expect(result).toEqual({
        credentials: [FIRST_VC],
        exchangeCount: 1,
        redirectUrl: SECOND_URL,
        canceled: true
      });
    });

    it('lets the caller stop a chain that never ends', async () => {
      const LOOP_URL = `${FIRST_URL}?iuv=1`;
      const counts = [];
      const h = harness({});
      h.startExchange = () => {
        if(h.visited.length > 10) {
          throw new Error('the chain was never stopped');
        }
        return exchangeReturning([
          {value: {redirectUrl: LOOP_URL}, done: true}
        ]);
      };
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...h,
        onBeforeContinue({exchangeCount}) {
          counts.push(exchangeCount);
          return exchangeCount < 3;
        }
      });
      expect(counts).toEqual([1, 2, 3]);
      expect(h.visited).toHaveLength(3);
      expect(result.exchangeCount).toBe(3);
      expect(result.canceled).toBe(true);
    });

    it('runs after the leg is reported', async () => {
      const order = [];
      await completeInteractionChain({
        interactionUrl: FIRST_URL, ...harness(CHAINED),
        onLegComplete({interactionUrl}) {
          order.push(`leg:${interactionUrl}`);
        },
        onBeforeContinue({interactionUrl}) {
          order.push(`continue:${interactionUrl}`);
          return true;
        }
      });
      expect(order).toEqual([
        `leg:${FIRST_URL}`, `continue:${SECOND_URL}`, `leg:${SECOND_URL}`
      ]);
    });

    it('is handed credentials it cannot mutate', async () => {
      const handed = [];
      const result = await completeInteractionChain({
        interactionUrl: FIRST_URL, ...harness(CHAINED),
        onBeforeContinue({credentials}) {
          handed.push(credentials);
          credentials[0].credentialSubject.id = 'urn:uuid:tampered';
          credentials.push('mutated');
          return true;
        }
      });
      expect(handed).toHaveLength(1);
      expect(result.credentials).toEqual([FIRST_VC, SECOND_VC]);
    });
  });

  describe('signOptions', () => {
    it('passes them to every step of every exchange', async () => {
      const signOptions = {suite: 'test-suite'};
      const h = harness({
        [FIRST_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: {redirectUrl: SECOND_URL}, done: true}
        ],
        [SECOND_URL]: [
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: presentationOf(SECOND_VC), done: true}
        ]
      });
      await completeInteractionChain({
        interactionUrl: FIRST_URL, signOptions,
        onPresentationRequest: () => ANSWER, ...h
      });
      const seen = h.exchanges.flatMap(e => e.calls);
      expect(seen).toHaveLength(4);
      for(const call of seen) {
        expect(call.signOptions).toBe(signOptions);
      }
    });
  });

  describe('presentation requests', () => {
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
          {value: {verifiablePresentationRequest: VPR}, done: false},
          {value: presentationOf(FIRST_VC), done: true}
        ]
      });
      const answers = [
        {verifiablePresentation: ANSWER, signOptions: answerSignOptions},
        ANSWER
      ];
      await completeInteractionChain({
        interactionUrl: FIRST_URL, signOptions: chainSignOptions,
        onPresentationRequest: () => answers.shift(),
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
    const h = harness({
      [FIRST_URL]: [
        {
          value: {
            ...presentationOf(FIRST_VC), verifiablePresentationRequest: VPR
          },
          done: false
        },
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
            ...presentationOf(FIRST_VC), redirectUrl: SECOND_URL
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
        onBeforeContinue: () => true,
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
              ...presentationOf(FIRST_VC), redirectUrl: SECOND_URL
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
