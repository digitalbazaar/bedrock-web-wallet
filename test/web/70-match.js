/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import * as webWallet from '@bedrock/web-wallet';
import {config} from '@bedrock/web';

const {presentations} = webWallet;

const CONTEXT = ['https://www.w3.org/ns/credentials/v2'];
const TYPES = ['AlumniCredential', 'BadgeCredential', 'EmployeeCredential'];

function queryByExample({type, group}) {
  return {
    type: 'QueryByExample',
    group,
    credentialQuery: {example: {'@context': CONTEXT, type}}
  };
}

// a credential store that holds one credential for each of `types`; the
// remote store query is the requested type
function credentialStoreFor({types}) {
  const records = types.map(type => ({
    meta: {id: `urn:uuid:${type}`},
    content: {'@context': CONTEXT, type: ['VerifiableCredential', type]}
  }));
  return {
    local: {
      async find() {
        return {documents: []};
      }
    },
    remote: {
      async convertVPRQuery({vprQuery}) {
        return {queries: [vprQuery.credentialQuery.example.type]};
      },
      async find({query: type}) {
        return {documents: records.filter(
          ({content}) => content.type.includes(type))};
      }
    }
  };
}

function matchedTypes(result) {
  return result.flat.map(({record}) => record.content.type[1]);
}

// the matched credential types for each query in `result.and`
function matchedTypesByQuery(result) {
  return result.and.map(({matches}) => matches.flatMap(
    ({matches}) => matches.map(({record}) => record.content.type[1])));
}

describe('presentations.match()', function() {
  const credentialStore = credentialStoreFor({types: TYPES});

  function match(query) {
    return presentations.match({
      verifiablePresentationRequest: {query}, credentialStore
    });
  }

  it('should return the only group when every query is grouped.', async () => {
    const result = await match(
      TYPES.map(type => queryByExample({type, group: 'a'})));
    matchedTypesByQuery(result).should.eql(TYPES.map(type => [type]));
    matchedTypes(result).should.eql(TYPES);
    result.groupResults.get('a').should.include(
      {flat: result.flat, and: result.and});
  });

  it('should return the ungrouped queries when some queries are grouped.',
    async () => {
      const [ungrouped, grouped] = TYPES;
      const result = await match([
        queryByExample({type: grouped, group: 'a'}),
        queryByExample({type: ungrouped})
      ]);
      matchedTypes(result).should.eql([ungrouped]);
      [...result.groupResults.keys()].should.eql(['a', undefined]);
    });

  it('should return the first group when no query is ungrouped.',
    async () => {
      const [first, second] = TYPES;
      const result = await match([
        queryByExample({type: first, group: 'a'}),
        queryByExample({type: second, group: 'b'})
      ]);
      matchedTypes(result).should.eql([first]);
      [...result.groupResults.keys()].should.eql(['a', 'b']);
      matchedTypes(result.groupResults.get('b')).should.eql([second]);
    });

  it('should return empty results when no query type is supported.',
    async () => {
      const result = await match([{type: 'UnsupportedQuery'}]);
      result.flat.should.eql([]);
      result.and.should.eql([]);
      result.groupResults.size.should.equal(0);
    });

  describe('with `maxQueries`', function() {
    const {limits} = config.wallet.exchanges;
    let maxQueries;
    beforeEach(() => {
      ({maxQueries} = limits);
    });
    afterEach(() => {
      limits.maxQueries = maxQueries;
    });

    it('should drop groups that exceed the query limit.', async () => {
      const [first, second, third] = TYPES;
      // group `a` fills the limit exactly; group `b` exceeds it
      limits.maxQueries = 2;
      const result = await match([
        queryByExample({type: first, group: 'a'}),
        queryByExample({type: second, group: 'a'}),
        queryByExample({type: third, group: 'b'})
      ]);
      [...result.groupResults.keys()].should.eql(['a']);
      matchedTypes(result).should.eql([first, second]);
    });

    it('should throw when every group exceeds the query limit.', async () => {
      limits.maxQueries = TYPES.length - 1;
      let result;
      let err;
      try {
        result = await match(
          TYPES.map(type => queryByExample({type, group: 'a'})));
      } catch(e) {
        err = e;
      }
      should.exist(err);
      should.not.exist(result);
      err.name.should.equal('NotSupportedError');
      err.message.should.contain(`("${limits.maxQueries}")`);
    });
  });
});
