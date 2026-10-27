const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { build } = require('../scripts/openapi');

describe('OpenAPI', () => {
  test('todas as rotas estão documentadas e design/openapi.yaml está atualizado', () => {
    const doc = build();
    const file = yaml.load(fs.readFileSync(path.join(__dirname, '..', '..', 'design', 'openapi.yaml'), 'utf8'));
    expect(file).toEqual(JSON.parse(JSON.stringify(doc)));
  });
});
