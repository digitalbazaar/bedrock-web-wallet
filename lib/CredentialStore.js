/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {getRemoteVcStore} from './remoteCredentials.js';
import {getLocalVcStore} from './localCredentials.js';

export class CredentialStore {
  constructor({profileId}) {
    this.profileId = profileId;
    this.remoteVcStore = null;
    this.localVcStore = null;
  }

  async init() {
    const {profileId} = this;
    this.remoteVcStore = await getRemoteVcStore({profileId});
    this.localVcStore = await getLocalVcStore({profileId});
  }

  async deleteCredential({id}) {
    const promises = [
      this.localVcStore.delete({id}),
      this.remoteVcStore.delete({id})
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
