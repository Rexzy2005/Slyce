# SLYYCE Admin Panel Authentication Replacement

## Objective

Stop and supersede the previously requested administrator authentication implementation in `backend-fix.md` that requires migrating the admin panel to the main game's Reown authentication provider.

Do not continue investigating or implementing Reown-based administrator authentication. Replace that approach with a dedicated, secure, seeded email-and-password authentication system for the SLYYCE admin panel.

Before making changes, inspect the existing repository, the current admin panel implementation, `backend-fix.md`, the backend authentication middleware, session handling, environment configuration, and relevant tests. Then implement the replacement directly in the codebase.

## 1. Administrator Account

The initial administrator account must use this email address:

`timothypererat2004@gmail.com`

I will provide the password separately. **Do not invent, generate, hardcode, or commit a password.** Prepare the implementation so I can supply the password through a secure backend environment variable or a dedicated account-seeding process.

The initial administrator account must be created through a backend-only seed process. The seed process must:

- Normalize the email address by trimming whitespace and converting it to lowercase.
- Hash the password using a suitable password-hashing algorithm such as Argon2id or bcrypt with an appropriate work factor.
- Store only the password hash, never the plaintext password.
- Assign the account an explicit administrator role and active status.
- Be idempotent, so running the seed process again does not create duplicate accounts or unintentionally overwrite an existing password.
- Never expose the password, password hash, or seed credentials to the frontend, API responses, logs, source control, or client-side environment variables.
- Fail safely if required seed configuration is missing or invalid.

Do not create a default or fallback password.

## 2. Backend Email Allowlist Enforcement

The backend must independently enforce the administrator email allowlist before granting administrator access.

Use this environment variable:

`SLYCE_ADMIN_EMAILS=timothypererat2004@gmail.com`

Implementation requirements:

- Parse `SLYCE_ADMIN_EMAILS` as a comma-separated list of email addresses.
- Trim whitespace, normalize addresses to lowercase, and ignore empty entries.
- Fail closed if the variable is missing or the resulting allowlist is empty.
- Normalize the submitted login email before comparing it with the allowlist.
- Check the allowlist on the backend during authentication. A matching seeded account must not be allowed to log in as an administrator if its email is absent from the configured allowlist.
- Check that the account exists, is active, has the administrator role, and has a valid password.
- Never rely on frontend checks, localStorage values, hidden routes, or client-submitted roles to authorize an administrator.
- Ensure all protected administrator API endpoints independently validate the authenticated session and administrator authorization.

The seeded administrator email and the backend allowlist must agree. If they do not, access must be denied.

Keep the allowlist server-side only. Do not expose it through public frontend environment variables or client-facing configuration endpoints.

## 3. Admin Login UI

Prepare the admin panel UI for this authentication system.

The login page must include:

- SLYYCE branding consistent with the existing admin panel.
- An email input.
- A password input with a show/hide password control.
- A clearly visible Sign In button.
- Loading and disabled states while authentication is in progress.
- A user-friendly error message for invalid credentials or unauthorized email addresses.
- Appropriate handling of network errors and server errors.
- Responsive layouts for mobile and desktop.
- Accessible labels, keyboard navigation, and appropriate input autocomplete attributes.

The email field may be prefilled with `timothypererat2004@gmail.com` for convenience, but the password must never be prefilled or displayed.

Remove the Supabase OTP-specific login UI, OTP cooldown UI, and any Reown-specific administrator login UI that is no longer needed. Preserve the existing admin dashboard, navigation, and management features.

Do not redesign unrelated parts of the admin panel.

## 4. Authentication and Session Architecture

Implement authentication entirely through the backend.

The login flow must be:

1. The admin submits their email and password through the login UI.
2. The backend validates the request and applies login rate limiting.
3. The backend normalizes the email and checks `SLYCE_ADMIN_EMAILS`.
4. The backend retrieves the seeded account and checks that it is active and has the administrator role.
5. The backend verifies the submitted password against the stored password hash.
6. Only after all checks pass, the backend establishes a secure authenticated session.
7. The frontend uses that session to access the admin dashboard and protected admin APIs.

Use secure, server-managed sessions or an equivalent well-supported session architecture. Prefer cookies configured with `HttpOnly`, `Secure` in production, and an appropriate `SameSite` policy. Protect state-changing requests against CSRF where required by the selected cookie architecture.

Additional requirements:

- Apply rate limiting to login attempts.
- Use generic authentication failure messages that do not reveal whether an email exists or is allowlisted.
- Validate session expiry and revoke sessions on logout.
- Ensure session identifiers are rotated after successful authentication.
- Enforce the administrator role and current allowlist policy on protected backend routes.
- Do not use localStorage as the authority for authentication, session expiry, or administrator permissions.
- Do not accept an email address or administrator role from the frontend as proof of authorization.
- Do not use Supabase OTP or Reown identity as a prerequisite for this dedicated admin login.
- Keep the game's existing Reown wallet and email connection flow unchanged.

Choose a session implementation compatible with the current SLYYCE backend and deployment environment. Do not introduce an unnecessarily complex authentication framework if the existing stack can support this securely.

## 5. Remove the Superseded Implementation

Identify and remove or replace the old administrator-authentication code, including the Supabase OTP login flow and its associated frontend and backend dependencies, wherever they are used exclusively for administrator authentication.

Update the existing admin auth implementation, middleware, configuration, documentation, and tests accordingly.

Before removing any Supabase package or configuration, verify that it is not used by other SLYYCE features. Do not break unrelated functionality.

Remove obsolete administrator-authentication environment variables and documentation references only after confirming they are no longer needed.

Update `backend-fix.md` so the seeded email-and-password approach supersedes the earlier Reown administrator-auth migration requirement. Do not leave contradictory authentication instructions in the repository.

## 6. Security and Regression Tests

Implement and run tests covering at least the following scenarios:

1. The configured, seeded administrator can log in with the correct password.
2. The correct password is rejected when the email is not in `SLYCE_ADMIN_EMAILS`.
3. An email in the allowlist cannot log in without a seeded account.
4. Incorrect passwords are rejected.
5. Inactive accounts are rejected.
6. Accounts without the administrator role are rejected.
7. Missing or empty `SLYCE_ADMIN_EMAILS` fails closed.
8. Email normalization works for uppercase input and surrounding whitespace.
9. Login attempts are rate-limited.
10. Unauthenticated requests cannot access protected admin APIs.
11. A normal authenticated user cannot access administrator-only endpoints.
12. Logout invalidates the session.
13. Expired or invalid sessions are rejected.
14. Changing the allowlist takes effect according to the implemented configuration-reload policy.
15. The frontend does not contain the seeded password or password hash.
16. Existing SLYYCE gameplay, wallet connections, and unrelated admin features continue to work.

Run the available linting, type checks, relevant unit and integration tests, and production build. Run browser acceptance tests against the configured project where the required environment is available. Do not claim a test passed unless it was actually executed.

## 7. Environment Configuration and Handoff

Update the appropriate environment example file with placeholders only. For example:

`SLYCE_ADMIN_EMAILS=timothypererat2004@gmail.com`

Provide a separate documented placeholder for the initial seed password, using a server-only variable name selected by the implementation. Do not include a real password.

Document exactly how to:

- Configure the admin allowlist.
- Supply the initial password securely.
- Run the administrator seed process.
- Start the backend and frontend.
- Log in to the admin panel.
- Change or rotate the administrator password.
- Troubleshoot authentication failures safely.

Do not request or commit the actual password as part of the code changes. I will supply it through the secure configuration or seeding mechanism.

## 8. Completion Report

When finished, provide a concise report stating:

- What files and authentication components changed.
- Which old authentication mechanisms were removed.
- How the seeded account and backend allowlist work together.
- The exact environment variables required, without secret values.
- The command needed to seed the administrator.
- Which tests and builds were actually executed and their results.
- Any remaining blockers or manual deployment steps.

Do not stop at writing a plan or documenting the changes. Implement the replacement in the repository, test it, and report any genuine blockers. The final implementation must keep administrator authentication and authorization enforced by the backend.