export function normalizeMsisdn(input: string): { ok: boolean; e164?: string; digits?: string; error?: string } {
  if (!input) return { ok: false, error: 'Empty phone' };
  const raw = (input || '').trim();
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return { ok: false, error: 'No digits found' };
  
  let digits = digitsOnly;
  if (digits.startsWith('0')) {
    digits = '60' + digits.slice(1);
  }
  
  if (!digits.startsWith('60')) {
    return { ok: false, error: 'Unsupported country code' };
  }
  
  const national = digits.slice(2);
  
  // Basic length check (9-11 digits)
  if (national.length < 9 || national.length > 11) {
    return { ok: false, error: 'Invalid Malaysian number length' };
  }
  
  // Stricter prefix checks
  // 010, 012, 013, 014, 016, 017, 019 usually have 7 digits (total 9 national)
  // 011, 015 usually have 8 digits (total 10 national)
  // 018 usually 7 or 8 digits?
  
  // If prefix is 12 (012), length MUST be 9 (e.g. 12xxxxxxx)
  // If we have 10 digits for 012 (e.g. 12xxxxxxxx), it's invalid.
  const prefix = national.substring(0, 2);
  const isSevenDigitPrefix = ['10', '12', '13', '14', '16', '17', '19'].includes(prefix);
  const isEightDigitPrefix = ['11', '15'].includes(prefix);
  
  if (isSevenDigitPrefix && national.length !== 9) {
     // Allow some flexibility if user entered 010-xxxxxxx (7 digits)
     // But 012 with 8 digits is definitely wrong.
     // Let's return error to help user debug.
     return { ok: false, error: `Invalid length for prefix 0${prefix}. Expected 7 digits, got ${national.length - 2}.` };
  }
  
  if (isEightDigitPrefix && national.length !== 10) {
      return { ok: false, error: `Invalid length for prefix 0${prefix}. Expected 8 digits, got ${national.length - 2}.` };
  }

  return { ok: true, e164: `+${digits}`, digits };
}
