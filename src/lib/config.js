import dotenv from 'dotenv';

dotenv.config();

export function getConfig() {
  const config = {
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    scheduleId: process.env.SCHEDULE_ID,
    // Allow FACILITY_ID to be provided in several formats and normalize it:
    // - JSON array: ["89","90"]
    // - Comma/semicolon/space separated: "89,90" or "89 90" or "89;90"
    // - Single value: "89"
    facilityId: (() => {
      const raw = process.env.FACILITY_ID;
      if (!raw) return raw;

      const trimmed = String(raw).trim();

      // Try JSON parse if it looks like an array
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
        } catch (e) {
          // fall through to other parsing
        }
      }

      // Split by common separators (comma, semicolon or whitespace). Remove surrounding brackets if present.
      const cleaned = trimmed.replace(/^\[|\]$/g, '');
      const parts = cleaned.split(/[;,\s]+/).map(s => s.trim()).filter(Boolean);

      if (parts.length > 1) return parts;
      return parts.length === 1 ? parts[0] : trimmed;
    })(),
    countryCode: process.env.COUNTRY_CODE,
    refreshDelay: Number(process.env.REFRESH_DELAY || 3)
  };

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  const required = ['email', 'password', 'scheduleId', 'facilityId', 'countryCode'];
  const missing = required.filter(key => !config[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.map(k => k.toUpperCase()).join(', ')}`);
    process.exit(1);
  }
}

export function getBaseUri(countryCode) {
  return `https://ais.usvisa-info.com/en-${countryCode}/niv`;
}
