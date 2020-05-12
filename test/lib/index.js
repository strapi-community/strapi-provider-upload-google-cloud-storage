const { strict: assert } = require('assert');
const provider = require('../../lib/index');

describe('/lib/index.js', () => {
  it('must export init function', () => {
    assert.ok(Object.keys(provider).includes('init'));
    assert.ok(typeof provider.init === 'function');
  });
});
