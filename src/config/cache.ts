import NodeCache from 'node-cache';

export const appCache = new NodeCache({
    stdTTL: 600, // 10 minutes default TTL
    checkperiod: 120 // Check for expired keys every 2 minutes
});

export const CACHE_KEYS = {
    ACTIVE_SESSION_TERMS: 'active_session_terms',
    LEDGER_SUMMARY: 'ledger_summary',
    BASE64_LOGO: 'base64_logo'
};
