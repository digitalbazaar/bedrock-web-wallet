/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';

/**
 * Tests for renderToNfc() renderProperty validation.
 *
 * `renderProperty` behavior:
 *
 * Current (static rendering):
 *
 * Optional field for transparency (documents which credential fields
 * are represented in the pre-encoded template).
 * When present, validates that referenced fields exist in credential.
 * Does NOT affect rendering output (template is always decoded as-is).
 * Missing or empty array skips validation.
 *
 * Future (dynamic rendering - not yet implemented):
 * Will be required for dynamic render methods.
 * Will extract specified fields from credential at runtime.
 * Will encode extracted data and generate template dynamically.
 */
describe('NFC Renderer', function() {
  describe('renderToNfc() - renderProperty Validation', function() {
    describe('Template Requirement', function() {
      it('should fail when only renderProperty exists without template',
        async () => {
          // template is always required, renderProperty alone is insufficient
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              name: 'Alice Smith'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderProperty: ['/credentialSubject/name'],
              outputPreference: {
                mode: ['nfc']
              }
              // no template - pre-filtered as invalid
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.exist(err);
          should.not.exist(result);
          err.message.should.contain('does not support NFC');
        }
      );
    });

    describe('Field Existence Validation', function() {
      it('should succeed when renderProperty references existing field',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              name: 'Alice Smith'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: ['/credentialSubject/name'],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);

          // template is decoded, NOT the credential field value
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
          decoded.should.not.equal('Alice Smith');
        }
      );

      it('should fail when renderProperty references non-existent field',
        async () => {
          // valid template, but renderProperty validation fails first
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              name: 'Alice'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: ['/credentialSubject/nonExistentField'],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.exist(err);
          should.not.exist(result);
        }
      );

      it('should validate all fields when multiple renderProperty pointers',
        async () => {
          // all pointers must resolve to existing fields
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              firstName: 'Alice',
              lastName: 'Smith'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: [
                '/credentialSubject/firstName',
                '/credentialSubject/lastName'
              ],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should fail if any renderProperty pointer is invalid',
        async () => {
          // one valid, one invalid - should fail
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              firstName: 'Alice'
              // lastName missing
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: [
                '/credentialSubject/firstName',
                '/credentialSubject/lastName'
              ],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.exist(err);
          should.not.exist(result);
        }
      );
    });

    describe('Optional renderProperty', function() {
      it('should succeed when renderProperty is missing',
        async () => {
          // renderProperty is optional
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              name: 'Alice'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              outputPreference: {
                mode: ['nfc']
              }
              // no renderProperty
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should succeed when renderProperty is empty array',
        async () => {
          // empty array treated as "no filtering"
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: [],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );
    });

    describe('Nested Field Access', function() {
      it('should validate deeply nested renderProperty pointers',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              address: {
                street: '123 Main St',
                city: 'Boston'
              }
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: ['/credentialSubject/address/city'],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should fail when nested path does not exist',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123',
              address: {
                street: '123 Main St'
                // city missing
              }
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: ['/credentialSubject/address/city'],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.exist(err);
          should.not.exist(result);
        }
      );
    });
  });
});
