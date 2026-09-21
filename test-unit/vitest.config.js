/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/*.spec.js'],
    environment: 'node'
  }
});
