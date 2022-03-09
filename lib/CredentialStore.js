/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';
import pAll from 'p-all';
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

    // normalize `credentials` to an array
    credentials = Array.isArray(credentials) ? credentials : [credentials];

    // get local and remote ops and run them in parallel
    const {profileId: holder} = this;
    const localOps = _createUpsertOps({holder, credentials, store: 'local'});
    const remoteOps = _createUpsertOps({holder, credentials, store: 'remote'});
    const localMapper = async op => this.local.upsert(op);
    const remoteMapper = async op => this.remote.upsert(op);
    const actions = [
      // at most `OPS_CONCURRENCY` local ops at a time
      async () => pMap(localOps, localMapper, {
        concurrency: OPS_CONCURRENCY, stopOnError: false
      }),
      // at most `OPS_CONCURRENCY` remote ops at a time
      async () => pMap(remoteOps, remoteMapper, {
        concurrency: OPS_CONCURRENCY, stopOnError: false
      })
    ];
    // both local and remote ops will run concurrently
    await pAll(actions, {concurrency: 2, stopOnError: false});
  }

  async delete({id, deleteBundle = true, force = false} = {}) {
    if(!(id && typeof id === 'string')) {
      throw new TypeError('"id" must be a non-empty string.');
    }
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
}

// recursively builds bundle contents
function _createBundleContents({
  holder, defaultMeta, filter, filterMap, remaining
}) {
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
      // always add `holder` to meta
      const entry = {credential, meta: {holder, ...meta}};
      if(subFilter.dependent) {
        entry.dependent = true;
      }
      bundleContents.push(entry);

      // recursively handle any sub-bundle contents
      if(credential.id && subFilter.bundleContents) {
        const contents = _createBundleContents({
          holder, defaultMeta, filter: subFilter, filterMap, remaining
        });
        if(contents.length > 0) {
          entry.bundleContents = contents;
        }
      }
    }
  }
  return bundleContents;
}

function _createUpsertOps({holder, credentials, store}) {
  // determine necessary upsert operations for `credentials`
  const upserts = [];

  // filter credentials (`_getFilterMap` gets *all* nested filters)
  const {filterMap} = _getFilterMap({store});
  const remaining = new Set();
  const {defaults} = config.wallet.credentialStore[store];
  // always add `holder` to meta
  const defaultMeta = {holder, ...defaults.meta};
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
      // always add `holder` to meta
      const op = {credential, meta: {holder, ...meta}};

      // a credential can only be a bundle if it has an ID
      if(credential.id && filter.bundleContents) {
        const contents = _createBundleContents({
          holder, defaultMeta, filter, filterMap, remaining
        });
        if(contents.length > 0) {
          op.bundleContents = contents;
        }
      }

      // VC should not be stored
      if(filter.store === false) {
        continue;
      }

      // store credential
      upserts.push(op);
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
  const {filters} = config.wallet.credentialStore[store];
  let next = filters;
  while(next.length > 0) {
    const current = next;
    next = [];
    for(const filter of current) {
      filterMap.set(filter, []);
      if(filter.bundleContents) {
        next.push(...filter.bundleContents);
      }
    }
  }
  return {filterMap};
}

function _matchesFilter({credential, filter}) {
  // both a context and a type must match
  return credential['@context'].includes(filter.context) &&
    credential.type.includes(filter.type);
}
