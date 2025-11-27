import * as webWallet from '@bedrock/web-wallet';

describe('NFC Renderer', function() {
  describe('supportsNfc()', function() {
    // Test to verify if a credential supports NFC rendering.
    it('should return true for credential with nfc renderSuite and template',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return false when template is missing ' +
      '(pre-filters invalid methods)',
    async () => {
      // supportsNfc() should only return true for VALID render methods.
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        credentialSubject: {
          id: 'did:example:123',
          name: 'John Doe'
        },
        renderMethod: {
          type: 'TemplateRenderMethod',
          renderSuite: 'nfc',
          renderProperty: ['/credentialSubject/name']
          // missing template - will fail in renderToNfc()
        }
      };

      const result = webWallet.nfcRenderer.supportsNfc({credential});
      should.exist(result);
      result.should.equal(false);
    }
    );

    it('should return true for credential with generic nfc renderSuite',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    // Legacy format uses 'payload' field instead of 'template'
    it('should return true for legacy NfcRenderingTemplate2024 type',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            payload: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return true for credential with renderMethod array',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: [
            {
              type: 'SvgRenderingTemplate2023',
              template: 'some-svg-data'
            },
            {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
            }
          ]
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return false for credential without renderMethod',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(false);
      }
    );

    it('should return false for credential with non-NFC renderMethod',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'SvgRenderingTemplate2023',
            template: 'some-svg-data'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(false);
      }
    );

    it('should detect NFC renderSuite case-insensitively',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            // uppercase
            renderSuite: 'NFC',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNfc({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );
  });

  describe('renderToNfc() - Template Decoding', function() {
    it('should successfully render static NFC with multibase-encoded template',
      async () => {
        // Base58 multibase encoded "Hello NFC" (z = base58btc prefix)
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'z2drAj5bAkJFsTPKmBvG3Z'
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
        result.bytes.should.be.an.instanceof(Uint8Array);
        result.bytes.length.should.be.greaterThan(0);
      }
    );

    it('should successfully render static NFC with base64url-encoded template',
      async () => {
        // Base64URL encoded "Test Data"
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'uVGVzdCBEYXRh'
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
        result.bytes.should.be.an.instanceof(Uint8Array);
      }
    );

    it('should successfully render static NFC with data URI format',
      async () => {
        // Data URI with base64 encoded "NFC Data"
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'data:application/octet-stream;base64,TkZDIERhdGE='
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
        result.bytes.should.be.an.instanceof(Uint8Array);
        // Verify decoded content
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('NFC Data');
      }
    );

    // Field validation: TemplateRenderMethod uses 'template', not 'payload'
    it('should ignore payload field when TemplateRenderMethod has both fields',
      async () => {
        // Per spec: unknown fields are ignored
        // TemplateRenderMethod uses 'template', 'payload' is ignored
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // "Hello NFC"
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            // "Different"
            payload: 'uRGlmZmVyZW50'
          }
        };

        let result;
        let err;
        try {
          result = await webWallet.nfcRenderer.renderToNfc({credential});
        } catch(e) {
          err = e;
        }

        // Should succeed - payload is ignored
        should.not.exist(err);
        should.exist(result);
        should.exist(result.bytes);

        // Verify template was used (not payload)
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('Hello NFC');
        decoded.should.not.equal('Different');
      }
    );

    // Field validation: NfcRenderingTemplate2024 uses 'payload', not 'template'
    it('should fail when NfcRenderingTemplate2024 uses template field',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            // wrong field - it should be payload
            template: 'z2drAj5bAkJFsTPKmBvG3Z'
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
        // Pre-filtered: render method not found (missing template)
        err.message.should.contain('does not support NFC');
      }
    );

    // Template is required for all NFC rendering
    it('should fail TemplateRenderMethod has no template field',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc'
            // No template field - pre-filtered as invalid
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
        // Pre-filtered: render method not found (missing template)
        err.message.should.contain('does not support NFC');
      }
    );

    it('should fail when template encoding is invalid',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'xInvalidEncoding123'
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
        err.message.should.contain('encoding format');
      }
    );

    it('should work with legacy NfcRenderingTemplate2024 using payload field',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            // Using 'payload', not 'template'
            payload: 'z2drAj5bAkJFsTPKmBvG3Z'
          }
        };

        let result;
        let err;

        try {
          result = await webWallet.nfcRenderer.renderToNfc({credential});
        } catch(error) {
          err = error;
        }

        should.not.exist(err);
        should.exist(result);
        should.exist(result.bytes);
        result.bytes.should.be.an.instanceof(Uint8Array);
      }
    );

    it('should decode template even when renderProperty is present',
      async () => {
        // Template contains "Hello NFC"
        // renderProperty indicates what fields are disclosed (for transparency)
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            greeting: 'Hello'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // "Hello NFC" as base64 in data URI format
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            // For transparency
            renderProperty: ['/credentialSubject/greeting']
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

        // Should decode template, renderProperty is for transparency only
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('Hello NFC');
      }
    );

    it('should fail when renderProperty references non-existent field',
      async () => {
        // Template is valid, but renderProperty validation fails
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            name: 'Alice'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'z2drAj5bAkJFsTPKmBvG3Z',
            // Doesn't exist!
            renderProperty: ['/credentialSubject/nonExistent']
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
        err.message.should.contain('Property not found');
      }
    );
  });

  describe('renderToNfc() - renderProperty Validation', function() {
    it('should fail when only renderProperty exists without template',
      async () => {
        // In unified architecture, template is always required
        // Without template, render method is pre-filtered as invalid
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice Smith'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            renderProperty: ['/credentialSubject/name']
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
        // Pre-filtered: render method not found
        err.message.should.contain('does not support NFC');
      }
    );

    it('should validate renderProperty field exists before decoding template',
      async () => {
        // renderProperty validates credential has the field
        // Then template is decoded (not the credential field!)
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice Smith'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // "Hello NFC" encoded
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            // Validates field exists
            renderProperty: [
              '/credentialSubject/name',
            ]
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
        // Should decode template, NOT extract "Alice Smith"
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('Hello NFC');
        decoded.should.not.equal('Alice Smith');
      }
    );

    // TODO: Delete later
    // it('should handle numeric values in dynamic rendering',
    //   async () => {
    //     const credential = {
    //       '@context': ['https://www.w3.org/ns/credentials/v2'],
    //       type: ['VerifiableCredential'],
    //       credentialSubject: {
    //         id: 'did:example:123',
    //         age: 25
    //       },
    //       renderMethod: {
    //         type: 'TemplateRenderMethod',
    //         renderSuite: 'nfc-dynamic',
    //         renderProperty: ['/credentialSubject/age']
    //       }
    //     };

    //     let result;
    //     let err;
    //     try {
    //       result = await webWallet.nfcRenderer.renderToNfc({credential});
    //     } catch(e) {
    //       err = e;
    //     }

    //     should.not.exist(err);
    //     should.exist(result);
    //     should.exist(result.bytes);
    //     const decoded = new TextDecoder().decode(result.bytes);
    //     decoded.should.equal('25');

    //   }
    // );

    // TODO: Delete later
    // it('should handle object values in dynamic rendering',
    //   async () => {
    //     const credential = {
    //       '@context': ['https://www.w3.org/ns/credentials/v2'],
    //       type: ['VerifiableCredential'],
    //       credentialSubject: {
    //         id: 'did:example:123',
    //         address: {
    //           street: '123 Main St',
    //           city: 'Boston'
    //         }
    //       },
    //       renderMethod: {
    //         type: 'TemplateRenderMethod',
    //         renderSuite: 'nfc-dynamic',
    //         renderProperty: ['/credentialSubject/address']
    //       }
    //     };

    //     let result;
    //     let err;
    //     try {
    //       result = await webWallet.nfcRenderer.renderToNfc({credential});
    //     } catch(e) {
    //       err = e;
    //     }

    //     should.not.exist(err);
    //     should.exist(result);
    //     should.exist(result.bytes);
    //     // Should be JSON stringified
    //     const decoded = new TextDecoder().decode(result.bytes);
    //     const parsed = JSON.parse(decoded);
    //     parsed.street.should.equal('123 Main St');
    //     parsed.city.should.equal('Boston');
    //   }
    // );

    // TODO: Delete later
    // it('should handle array access in JSON pointer',
    //   async () => {
    //     const credential = {
    //       '@context': ['https://www.w3.org/ns/credentials/v2'],
    //       type: ['VerifiableCredential'],
    //       credentialSubject: {
    //         id: 'did:example:123',
    //         skills: ['JavaScript', 'Python', 'Rust']
    //       },
    //       renderMethod: {
    //         type: 'TemplateRenderMethod',
    //         renderSuite: 'nfc-dynamic',
    //         renderProperty: ['/credentialSubject/skills/0']
    //       }
    //     };

    //     let result;
    //     let err;
    //     try {
    //       result = await webWallet.nfcRenderer.renderToNfc({credential});
    //     } catch(e) {
    //       err = e;
    //     }

    //     should.not.exist(err);
    //     should.exist(result);
    //     should.exist(result.bytes);
    //     const decoded = new TextDecoder().decode(result.bytes);
    //     decoded.should.equal('JavaScript');
    //   }
    // );

    // TODO: Delete later
    // it('should handle special characters in JSON pointer',
    //   async () => {
    //     const credential = {
    //       '@context': ['https://www.w3.org/ns/credentials/v2'],
    //       type: ['VerifiableCredential'],
    //       credentialSubject: {
    //         id: 'did:example:123',
    //         'field/with~slash': 'test-value'
    //       },
    //       renderMethod: {
    //         type: 'TemplateRenderMethod',
    //         renderSuite: 'nfc-dynamic',
    //         renderProperty: ['/credentialSubject/field~1with~0slash']
    //       }
    //     };

    //     let result;
    //     let err;
    //     try {
    //       result = await webWallet.nfcRenderer.renderToNfc({credential});
    //     } catch(e) {
    //       err = e;
    //     }

    //     should.not.exist(err);
    //     should.exist(result);
    //     should.exist(result.bytes);
    //     const decoded = new TextDecoder().decode(result.bytes);
    //     decoded.should.equal('test-value');
    //   }
    // );

    it('should succeed when renderProperty is missing but template exists',
      async () => {
        // renderProperty is optional - template is what matters
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // "Hello NFC"
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD'
            // No renderProperty
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

    it('should fail when renderProperty references non-existent field',
      async () => {
        // Even though template is valid, renderProperty validation fails
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // valid template
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            renderProperty: ['/credentialSubject/nonExistentField']
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
        err.message.should.contain('Property not found');
      }
    );

    it('should validate all renderProperty fields exist',
      async () => {
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
            renderSuite: 'nfc',
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            renderProperty: [
              '/credentialSubject/firstName',
              '/credentialSubject/lastName'
            ]
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
        // Template is decoded, not the fields
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('Hello NFC');
      }
    );

    it('should succeed when renderProperty is empty array',
      async () => {
        // Empty renderProperty is treated as "no filtering"
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            // Empty is OK
            renderProperty: []
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

    // TODO: Delete later
    // it('should fail when renderProperty is empty array',
    //   async () => {
    //     const credential = {
    //       '@context': ['https://www.w3.org/ns/credentials/v2'],
    //       type: ['VerifiableCredential'],
    //       credentialSubject: {
    //         id: 'did:example:123'
    //       },
    //       renderMethod: {
    //         type: 'TemplateRenderMethod',
    //         renderSuite: 'nfc-dynamic',
    //         renderProperty: []
    //       }
    //     };

    //     let result;
    //     let err;
    //     try {
    //       result = await webWallet.nfcRenderer.renderToNfc({credential});
    //     } catch(e) {
    //       err = e;
    //     }

    //     should.exist(err);
    //     should.not.exist(result);
    //     err.message.should.contain('cannot be empty');
    //   }
    // );
  });

  // TODO: Delete later
  // describe('renderToNfc() - Generic NFC Suite', function() {
  //   it('should prioritize static rendering when both payload and ' +
  //     'renderProperty exist', async () => {
  //     const credential = {
  //       '@context': ['https://www.w3.org/ns/credentials/v2'],
  //       type: ['VerifiableCredential'],
  //       credentialSubject: {
  //         id: 'did:example:123',
  //         name: 'Alice'
  //       },
  //       renderMethod: {
  //         type: 'TemplateRenderMethod',
  //         renderSuite: 'nfc',
  //         // "Hello NFC"
  //         template: 'z2drAj5bAkJFsTPKmBvG3Z',
  //         renderProperty: ['/credentialSubject/name']
  //       }
  //     };

  //     let result;
  //     let err;
  //     try {
  //       result = await webWallet.nfcRenderer.renderToNfc({credential});
  //     } catch(e) {
  //       err = e;
  //     }

  //     should.not.exist(err);
  //     should.exist(result);
  //     // Should use static rendering (template), not dynamic
  //     const decoded = new TextDecoder().decode(result.bytes);
  //     // If it was dynamic, it would be "Alice"
  //     decoded.should.not.equal('Alice');
  //   });

  //   it('should fallback to dynamic rendering when' +
  //    ' only renderProperty exists',
  //     async () => {
  //       const credential = {
  //         '@context': ['https://www.w3.org/ns/credentials/v2'],
  //         type: ['VerifiableCredential'],
  //         credentialSubject: {
  //           id: 'did:example:123',
  //           name: 'Bob'
  //         },
  //         renderMethod: {
  //           type: 'TemplateRenderMethod',
  //           renderSuite: 'nfc',
  //           renderProperty: ['/credentialSubject/name']
  //         }
  //       };

  //       let result;
  //       let err;
  //       try {
  //         result = await webWallet.nfcRenderer.renderToNfc({credential});
  //       } catch(e) {
  //         err = e;
  //       }

  //       should.not.exist(err);
  //       should.exist(result);
  //       const decoded = new TextDecoder().decode(result.bytes);
  //       decoded.should.equal('Bob');
  //     }
  //   );

  //   it('should fail when neither template nor renderProperty exist',
  //     async () => {
  //       const credential = {
  //         '@context': ['https://www.w3.org/ns/credentials/v2'],
  //         type: ['VerifiableCredential'],
  //         credentialSubject: {
  //           id: 'did:example:123'
  //         },
  //         renderMethod: {
  //           type: 'TemplateRenderMethod',
  //           renderSuite: 'nfc'
  //         }
  //       };

  //       let result;
  //       let err;
  //       try {
  //         result = await webWallet.nfcRenderer.renderToNfc({credential});
  //       } catch(e) {
  //         err = e;
  //       }

  //       should.exist(err);
  //       should.not.exist(result);
  //       err.message.should.contain('neither payload nor renderProperty');
  //     }
  //   );
  // });

  describe('renderToNfc() - Error Cases', function() {
    it('should fail when credential has no renderMethod',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123'
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
        err.message.should.contain('does not support NFC rendering');
      }
    );

    it('should fail when renderSuite is unsupported',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'unsupported-suite',
            template: 'some-data'
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
        err.message.should.contain('does not support NFC rendering');
      }
    );

    it('should fail when credential parameter is missing',
      async () => {
        let result;
        let err;
        try {
          result = await webWallet.nfcRenderer.renderToNfc({});
        } catch(e) {
          err = e;
        }

        should.exist(err);
        should.not.exist(result);
      }
    );

    it('should fail when data URI has wrong media type',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // Wrong media type - should be application/octet-stream
            template: 'data:text/plain;base64,SGVsbG8='
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
        err.message.should.contain('media type');
      }
    );

    it('should fail when data URI format is malformed',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // Malformed data URI (missing encoding or data)
            template: 'data:application/octet-stream'
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
        err.message.should.contain('Invalid data URI');
      }
    );

    it('should fail when multibase encoding is unsupported',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // 'f' is base16 multibase - not supported by implementation
            template: 'f48656c6c6f'
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
        err.message.should.contain('encoding format');
      }
    );

    it('should fail when data URI encoding is unsupported',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // hex encoding is not supported
            template: 'data:application/octet-stream;hex,48656c6c6f'
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
        err.message.should.contain('encoding');
      }
    );

    it('should fail when base64 data is invalid',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // Invalid base64 characters
            template: 'data:application/octet-stream;base64,!!!invalid!!!'
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
        // Error message varies by environment (browser vs Node)
      }
    );

    it('should fail when template is not a string',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            // Template should be a string, not an object
            template: {
              type: 'embedded',
              data: 'some-data'
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

  describe('NFC Renderer - EAD Credential Tests (from URL)', function() {
    let eadCredential;

    // Fetch the credential once before all tests
    before(async function() {
      // Increase timeout for network request
      this.timeout(5000);

      try {
        const response = await fetch(
          'https://gist.githubusercontent.com/gannan08/b03a8943c1ed1636a74e1f1966d24b7c/raw/fca19c491e2ab397d9c547e1858ba4531dd4e3bf/full-example-ead.json'
        );

        if(!response.ok) {
          throw new Error(`Failed to fetch credential: ${response.status}`);
        }

        eadCredential = await response.json();
        console.log('✓ EAD Credential loaded from URL');
      } catch(error) {
        console.error('Failed to load EAD credential:', error);
        // Skip all tests if credential can't be loaded
        this.skip();
      }
    });

    describe('supportsNfc() - EAD from URL', function() {
      it('should return false for EAD credential without renderMethod',
        function() {
          // Skip if credential wasn't loaded
          if(!eadCredential) {
            this.skip();
          }

          // Destructure to exclude renderMethod
          // Create credential copy without renderMethod
          const credentialWithoutRenderMethod = {...eadCredential};
          delete credentialWithoutRenderMethod.renderMethod;

          const result = webWallet.nfcRenderer.supportsNfc({
            credential: credentialWithoutRenderMethod
          });

          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return true for EAD credential with renderMethod',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const result = webWallet.nfcRenderer.supportsNfc({
            credential: eadCredential
          });

          should.exist(result);
          result.should.equal(true);
        }
      );

      it('should return false when adding nfc renderMethod with renderProperty',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const credentialWithDynamic = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              renderProperty: ['/credentialSubject/givenName']
              // Note: no template, but supportsNfc() only checks capability
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({
            credential: credentialWithDynamic
          });

          should.exist(result);
          // Pre-filtered: returns false (not a valid NFC render method)
          result.should.equal(false);
        }
      );

      it('should return true when adding nfc renderMethod with template',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD'
            }
          };

          const result = webWallet.nfcRenderer.supportsNfc({
            credential
          });

          should.exist(result);
          result.should.equal(true);
        }
      );
    });

    describe('renderToNfc() - EAD Template Required Tests', function() {
      it('should fail when extracting givenName without template',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          // In unified architecture, template is required
          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              renderProperty: ['/credentialSubject/givenName']
              // No template - should fail!
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
          // Pre-filtered: render method not found
          err.message.should.contain('does not support NFC');
        }
      );

      it('should succeed when template is provided with renderProperty',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          // Encode "JOHN" as base58 multibase for template
          // Using TextEncoder + base58 encoding
          const johnBytes = new TextEncoder().encode('JOHN');
          const base58 = await import('base58-universal');
          const encodedJohn = 'z' + base58.encode(johnBytes);

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              template: encodedJohn,
              renderProperty: ['/credentialSubject/givenName']
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
          decoded.should.equal('JOHN');
        }
      );

      it('should validate renderProperty fields exist in credential',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: [
                '/credentialSubject/givenName',
                '/credentialSubject/additionalName',
                '/credentialSubject/familyName'
              ]
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
          // Template is decoded, not the credential fields
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );
    });

    describe('renderToNfc() - EAD Template Size Tests', function() {
      it('should fail when trying to extract image without template',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              renderProperty: ['/credentialSubject/image']
              // No template - should fail!
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
          // Pre-filtered: render method not found
          err.message.should.contain('does not support NFC');
        }
      );

      it('should decode large template successfully',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          // Get the actual image from credential for comparison
          const actualImage = eadCredential.credentialSubject.image;

          // Encode the image as base58 multibase template
          const imageBytes = new TextEncoder().encode(actualImage);
          const base58 = await import('base58-universal');
          const encodedImage = 'z' + base58.encode(imageBytes);

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc',
              // Large template with image data
              template: encodedImage,
              // Validates field exists
              renderProperty: ['/credentialSubject/image']
            }
          };

          const result = await webWallet.nfcRenderer.renderToNfc({credential});

          should.exist(result);
          should.exist(result.bytes);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.match(/^data:image\/png;base64,/);

          // Verify it's the full large image (should be > 50KB)
          result.bytes.length.should.be.greaterThan(50000);
        }
      );

    });
  });
});

