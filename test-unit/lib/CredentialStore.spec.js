/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('@bedrock/web', () => ({
  config: {
    wallet: {
      credentialStore: {
        local: {filters: [], defaults: {store: true, meta: {}}},
        remote: {filters: [], defaults: {store: true, meta: {}}}
      }
    }
  }
}));
vi.mock('../../lib/envelopes.js', () => ({}));

const {CredentialStore} = await import('../../lib/CredentialStore.js');

const PROFILE_ID = 'urn:uuid:profile';
const VC = {
  type: ['VerifiableCredential', 'ExampleCredential'],
  credentialSubject: {id: 'urn:uuid:subject'}
};

function createStore() {
  return {
    local: {upsert: vi.fn(async () => {})},
    remote: {upsert: vi.fn(async () => {})}
  };
}

describe('CredentialStore.add()', () => {
  let stores;
  let store;

  beforeEach(() => {
    stores = createStore();
    store = new CredentialStore({profileId: PROFILE_ID, ...stores});
  });

  it.each([
    ['an array', [VC]],
    ['a single credential', VC]
  ])('passes `credentials` as %s to both stores', async (_, credentials) => {
    await store.add({credentials});
    const expected = [{credential: VC, meta: {holder: PROFILE_ID}}];
    expect(stores.local.upsert.mock.calls.map(([op]) => op))
      .toEqual(expected);
    expect(stores.remote.upsert.mock.calls.map(([op]) => op))
      .toEqual(expected);
  });

  it('passes `records` through with their meta', async () => {
    await store.add({records: [{credential: VC, meta: {tag: 'a'}}]});
    expect(stores.local.upsert).toHaveBeenCalledExactlyOnceWith(
      {credential: VC, meta: {holder: PROFILE_ID, tag: 'a'}});
  });

  it('rejects `records` that is not an array', async () => {
    await expect(store.add({records: 'not-an-array'}))
      .rejects.toThrow('"records" must be an array.');
    expect(stores.local.upsert).not.toHaveBeenCalled();
  });
});
