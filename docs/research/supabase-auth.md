# Supabase Auth verification

**Verified:** 2026-10-27  
**Package:** `@supabase/supabase-js` 2.118.0

## Finding

The backend can validate a presented Supabase Auth bearer token with the Supabase JavaScript client's `auth.getUser(token)` call. The backend uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`; a service-role key is not required for this verification boundary and is intentionally not configured.

Administrator authorization is separate from authentication: verified user email addresses are normalized to lowercase and must match the server-only `ADMIN_EMAILS` allowlist. Wallet connection state is not accepted as a backend credential.

## Sources

- Supabase JavaScript `auth.getUser` reference: https://supabase.com/docs/reference/javascript/auth-getuser
- Supabase JavaScript package metadata: https://registry.npmjs.org/@supabase/supabase-js/2.118.0

The endpoint was smoke-tested with an intentionally malformed token; Supabase returned an invalid-token response, confirming the configured Auth endpoint was reached without exposing credentials. A valid user token was not available for local testing.
