/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';
import pMap from 'p-map';

// `10` is chosen as the concurrency value because it is the lowest power of
// ten that is an acceptable number of concurrent web requests when pipelining
// may not be available (for remote credential stores)
const OPS_CONCURRENCY = 10;

export class CredentialStore {
  constructor({profileId, local, remote}) {
    this.profileId = profileId;
    this.local = local;
    this.remote = remote;
  }

  async add({credentials} = {}) {
    /* Note: Presently, during bundle creation, every sub-credential in
    `credentials` with a type that matches a `bundleContents` sub-filter will
    be included in the first matching bundle, whether or not the the bundle
    credential has an actual link to it.

    Better filtering will need to be implemented to only link by ID, e.g.,
    perhaps JSON pointer in the bundle definition to where the links are
    in the linked VC. */

    const localOps = _createUpsertOps({credentials, store: 'local'});
    const remoteOps = _createUpsertOps({credentials, store: 'remote'});

    // FIXME: run local and remote ops in parallel; each with concurrency
    // of `OPS_CONCURRENCY`

    // add all credentials
    const actions = [];
    for(const credential of credentials) {
      const meta = metaMap.get(credential);
      for(const [, v] of meta.entries()) {
        if(v && this[v]) {
          actions.push(() => this[v].upsert({credential, meta: v}));
        }
      }
    }

    await pMap(actions, {concurrency: 5, stopOnError: false});
  }

  async delete({id, deleteBundle = true, force = false} = {}) {
    const promises = [
      this.local.delete({id, deleteBundle, force}),
      this.remote.delete({id, deleteBundle, force})
    ];
    const rejected = (await Promise.allSettled(promises))
      .filter(({status: s}) => s === 'rejected');
    if(rejected.length > 0) {
      const error = new Error(
        `The credential with ID "${id}" could not be deleted.`);
      error.name = 'OperationError';
      let cause;
      if(rejected.length > 1) {
        cause = new Error('Multiple errors.');
        cause.name = 'AggregateError';
        cause.errors = rejected.map(({reason}) => reason);
      } else {
        cause = rejected[0].reason;
      }
      error.cause = cause;
      throw error;
    }
  }

  // FIXME: remove me, old
  matchesFilterOld({credential, filter} = {}) {
    const {filters} = config.wallet.credentialStorage;
    if(!(filter in filters)) {
      throw new Error(`Unknown credential storage filter "${filter}".`);
    }
    for(const type of credential.type) {
      if(filters[filter][type]) {
        return true;
      }
    }
    return false;
  }

  // FIXME: old, remove
  _getBundleDefinitions({credential} = {}) {
    const {types: qualifiedTypes} = config.wallet.credentialStore;
    const definitions = [];
    for(const context of credential['@context']) {
      const types = qualifiedTypes[context];
      if(!types) {
        // no type configs for any types in this context
        continue;
      }
      for(const type of credential.type) {
        const c = qualifiedTypes[type];
        if(!c) {
          // no type config
          continue;
        }
        if(c.bundle) {
          definitions.push(c.bundle);
        }
      }
    }
    return definitions;
  }

  // FIXME: old, remove
  _createMeta({credential}) {
    const displayable = !this.matchesFilter({credential, filter: 'hidden'});
    const meta = {displayable, parentId: null};
    const bundle = this.matchesFilter({credential, filter: 'bundle'});
    if(bundle) {
      meta.linkedCredentialIds = createLinkedCredentials({
        credential, credentials
      });
    }
    if(credential.type.includes('OverAgeTokenCredential') && parentId) {
      const issuer = _getAgeVerifcationContainerIssuer({credentials});
      meta.parentId = parentId;
      meta.container = {
        name: 'Over Age Token Credential',
        description: 'The Over Age Token Credential can be used to prove ' +
          'that you are over a particular age.',
        issuer
      };
    }
    return {credential, meta};
  }
}

// recursively builds bundle contents
function _createBundleContents({defaultMeta, filter, filterMap, remaining}) {
  const bundleContents = [];
  for(const subFilter of filter.bundleContents) {
    if(remaining.size === 0) {
      // nothing more to assign
      break;
    }
    const matches = filterMap.get(subFilter);
    for(const credential of matches) {
      if(remaining.size === 0) {
        // nothing more to assign
        break;
      }
      if(!remaining.has(credential)) {
        // credential already assigned
        continue;
      }
      // mark credential as assigned
      remaining.delete(credential);
      const {meta = defaultMeta} = subFilter;
      const entry = {credential, meta};
      if(subFilter.dependent) {
        entry.dependent = true;
      }
      bundleContents.push(entry);

      // recursively handle any sub-bundle contents
      if(credential.id && subFilter.bundleContents) {
        const contents = _createBundleContents({
          defaultMeta, filter: subFilter, filterMap, remaining
        });
        if(contents.length > 0) {
          entry.bundleContents = contents;
        }
      }
    }
  }
  return bundleContents;
}

function _createUpsertOps({credentials, store}) {
  // determine necessary upsert operations for `credentials`
  const upserts = [];

  // filter credentials
  const {filterMap} = _getFilterMap({store});
  const remaining = new Set();
  const {defaults} = config.wallet.credentialStore[store];
  const {meta: {defaultMeta = {}}} = defaults;
  for(const credential of credentials) {
    let match = false;
    for(const [filter, matches] of filterMap) {
      if(_matchesFilter({credential, filter})) {
        matches.push(credential);
        match = true;
      }
    }

    // if credential matched a filter, it still needs additional processing
    if(match) {
      remaining.add(credential);
      continue;
    }

    // no matching filter, use defaults if storage is not disabled
    if(defaults.store !== false) {
      upserts.push({credential, meta: defaultMeta});
    }
  }

  // process remaining VCs that match filters, in filter priority order
  const {filters} = config.wallet.credentialStore[store];
  for(const filter of filters) {
    const matches = filterMap.get(filter);
    for(const credential of matches) {
      if(!remaining.has(credential)) {
        // credential already assigned
        continue;
      }
      // mark credential as assigned
      remaining.delete(credential);

      // start creating op
      const {meta = defaultMeta} = filter;
      const op = {credential, meta};
      upserts.push(op);

      // a credential can only be a bundle if it has an ID
      if(credential.id && filter.bundleContents) {
        const contents = _createBundleContents({
          defaultMeta, filter, filterMap, remaining
        });
        if(contents.length > 0) {
          op.bundleContents = contents;
        }
      }
    }
  }

  // handle any remaining unassigned credentials
  if(defaults.store !== false) {
    for(const credential of remaining) {
      upserts.push({credential, meta: defaultMeta});
    }
  }

  return upserts;
}

function _getFilterMap({store}) {
  const filterMap = new Map();
  // FIXME: remove qualifiedTypes
  //const qualifiedTypes = new Map();
  const {filters} = config.wallet.credentialStore[store];
  let next = filters;
  while(next.length > 0) {
    const current = next;
    next = [];
    for(const filter of current) {
      filterMap.set(filter, []);
      if(filter.bundleContents) {
        next.push(filter.bundleContents);
      }
      // FIXME: remove me if unused
      // const {context, type} = filter;
      // const entry = qualifiedTypes.get(context);
      // if(!entry) {
      //   qualifiedTypes.set(context, new Set([type]));
      // } else {
      //   entry.add(type);
      // }
    }
  }
  // FIXME: clean up if unused
  return {filterMap};//, qualifiedTypes};
}

function _matchesFilter({credential, filter}) {
  // both a context and a type must match
  return credential['@context'].includes(filter.context) &&
    credential.type.includes(filter.type);
}
