/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import * as webWallet from '@bedrock/web-wallet';
import {config} from '@bedrock/web';

const {presentations} = webWallet;

const provider = {
  label: 'Get credential',
  getInteractionUrl: async () => 'https://example.com/interactions/z1?iuv=1'
};

// a `match()` result entry for one query; `found` is the number of matches
function entry({query, found = 0}) {
  return {
    id: globalThis.crypto.randomUUID(),
    query,
    matches: query.type === 'QueryByExample' ? [{
      credentialQuery: query.credentialQuery,
      matches: Array.from({length: found}, () => ({record: {}}))
    }] : []
  };
}

function queryByExample(type) {
  return {
    type: 'QueryByExample',
    credentialQuery: {
      example: {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type
      }
    }
  };
}

describe('presentations.findCredentialProviders()', function() {
  let originalProviders;
  before(() => {
    originalProviders = config.wallet.credentialProviders;
    config.wallet.credentialProviders = {ExampleCredential: provider};
  });
  after(() => {
    config.wallet.credentialProviders = originalProviders;
  });

  it('should find a provider for an unmatched query.', async () => {
    const query = queryByExample('ExampleCredential');
    const results = presentations.findCredentialProviders({
      matchResult: {and: [entry({query})]}
    });
    results.length.should.equal(1);
    results[0].query.should.equal(query);
    results[0].type.should.equal('ExampleCredential');
    results[0].provider.should.equal(provider);
  });
  it('should find a provider when the example lists several types.',
    async () => {
      const query = queryByExample(['OtherCredential', 'ExampleCredential']);
      const results = presentations.findCredentialProviders({
        matchResult: {and: [entry({query})]}
      });
      results.length.should.equal(1);
      results[0].type.should.equal('ExampleCredential');
    });
  it('should skip a query that matched a credential.', async () => {
    const query = queryByExample('ExampleCredential');
    const results = presentations.findCredentialProviders({
      matchResult: {and: [entry({query, found: 1})]}
    });
    results.length.should.equal(0);
  });
  it('should skip a query whose type has no provider.', async () => {
    const query = queryByExample('OtherCredential');
    const results = presentations.findCredentialProviders({
      matchResult: {and: [entry({query})]}
    });
    results.length.should.equal(0);
  });
  it('should skip queries that are not "QueryByExample".', async () => {
    const query = {type: 'DIDAuthentication'};
    const results = presentations.findCredentialProviders({
      matchResult: {and: [entry({query})]}
    });
    results.length.should.equal(0);
  });
  it('should return nothing without a match result.', async () => {
    presentations.findCredentialProviders().length.should.equal(0);
  });
});
