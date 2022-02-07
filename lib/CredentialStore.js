/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';
import pMap from 'p-map';

export class CredentialStore {
  constructor({profileId, local, remote}) {
    this.profileId = profileId;
    this.local = local;
    this.remote = remote;
  }

  async add({credentials} = {}) {
    /* Note: Presently, during bundle processing, every sub-credential in
    `credentials` with a matching type will be linked to a bundle, even if it
    was already linked to another credential in `credentials`.

    This will result in the credential being part of more than one `bundle`.
    Better filtering will need to be implemented to only link by ID, e.g.,
    perhaps JSON pointer in the bundle definition to where the links are
    in the linked VC. */

    // FIXME: auto-filter `credentials` into bundles using config; this will
    // yield bundles for both `local` and `remote`

    // FIXME: add every bundle in parallel

    // create default meta (for both remote and local stores) for each
    // credential
    const metaMap = this._createMetaMap({credentials});

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

  matchesFilter({credential, filter} = {}) {
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
  _createLinkedCredentials({credential, credentials}) {
    if(credential.type.includes('AgeVerificationContainerCredential')) {
      const linkedCredentialIds = [];
      const linkedCredentialTypes = new Map([
        ['PersonalPhotoCredential', true],
        ['AgeVerificationCredential', true]
      ]);
      for(const cred of credentials) {
        const linkedCredential = _hasTypeIn({
          credential: cred, typeMap: linkedCredentialTypes
        });
        if(linkedCredential) {
          linkedCredentialIds.push(cred.id);
        }
      }
      return linkedCredentialIds;
    }
  }

  _createMetaMap({credentials}) {
    // create default meta (for both remote and local stores) for each
    // credential
    const metaMap = new Map();
    for(const credential of credentials) {
      metaMap.set(credential, this._createDefaultMeta({credential}));
    }

    // for all bundles in `credentials`, ensure that their linked credentials'
    // meta records bundle membership
    for(const credential of credentials) {
      const definitions = this._getBundleDefinitions({credential});

      // find all bundled credentials in all bundles
      const bundled = new Set();
      for(const definition of definitions) {
        credentials
          // VC must have an ID to be linked and may not legally link to itself
          .filter(c => c !== credential && c.id &&
            _hasType({credential, qualifiedTypes: definition.includes}))
          .forEach(bundled.add, bundled);
      }

      // update meta for `credential` to include the bundled credentials
      const meta = metaMap.get(credential);
      for(const [, v] of Object.entries(meta)) {
        if(!v) {
          continue;
        }
        v.bundled = [...bundled];
      }

      // update the meta for each bundled VC to include `bundledBy` link
      for(const vc of bundled) {
        const meta = metaMap.get(vc);
        for(const [n, v] of Object.entries(meta)) {
          if(!v) {
            continue;
          }
          const m = meta[n];
          if(m.bundledBy) {
            m.bundledBy.push(credential.id);
          } else {
            m.bundledBy = [credential.id];
          }
        }
      }
    }
    return metaMap;
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

  _createDefaultMeta({credential}) {
    const meta = {local: undefined, remote: undefined};
    const {defaults, types: qualifiedTypes} = config.wallet.credentialStore;
    for(const context of credential['@context']) {
      const contextTypes = qualifiedTypes[context];
      if(!contextTypes) {
        continue;
      }
      for(const type of credential.type) {
        // process both `remote` and `local` meta defaults for the type
        const typeConfig = contextTypes[type];
        for(const [n, v] of Object.entries(typeConfig.stores || {})) {
          if(!(n && n.meta !== undefined)) {
            // no meta entry to process
            continue;
          }
          if(meta[n] !== undefined) {
            _warnDuplicateMeta({credential, name: n});
            continue;
          }
          meta[n] = _deepClone(v);
        }
      }
    }

    if(meta.local === undefined) {
      meta.local = _deepClone(defaults.stores.local);
    }
    if(meta.remote === undefined) {
      meta.remote = _deepClone(defaults.stores.remote);
    }
    return meta;
  }
}

function _deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function _hasType({credential, qualifiedTypes}) {
  return credential.type.some(t =>
    t in qualifiedTypes && credential['@context'].includes(qualifiedTypes[t]));
}

function _warnDuplicateMeta({credential, name}) {
  // generally should not happen
  console.warn(
    `Multiple ${name} meta data defaults detected for credential, ` +
    'using first match.', {credential});
}
