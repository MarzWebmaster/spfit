import { normalizeModel, normalizeSerial } from '../services/assetModelIntelService';

describe('assetModelIntelService normalize', () => {
  it('normalizeSerial: buang space dan tukar O kepada 0', () => {
    expect(normalizeSerial(' 35 34VV O ')).toBe('3534VV0');
  });

  it('normalizeModel: betulkan common OCR typo (LAITITUDE -> LATITUDE)', () => {
    expect(normalizeModel('DELL LAITITUDE 5430')).toBe('DELL LATITUDE 5430');
  });
});

