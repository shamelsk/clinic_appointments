# Engineering rationale

PostgreSQL and Prisma provide durable relational records for doctors, patients, appointments, users and the single clinic settings record. Foreign keys prevent orphaned records; appointments are retained on cancellation for operational history. Patient phone is normalized and unique, so booking with a known contact reuses the patient.

The appointment service derives a 30-minute end from a date and 15-minute-boundary start. It makes a readable overlap check before insert, but that cannot protect concurrent requests. The migration enables `btree_gist` and adds a partial exclusion constraint over doctor ID plus `[startAt,endAt)`, applying only to confirmed appointments. This makes back-to-back bookings legal and is the final authority under a race.

Cancellation is a state transition: server time compares start against the settings window. At the boundary it is free; after it the configured amount is persisted with `cancelledAt`. That preserves historical charges when settings later change. Starting appointments cannot normally be cancelled.

JWTs are HTTP-only cookies in browser usage, with a Bearer option useful for API tooling. Passwords use bcrypt. Registration has no role field and therefore cannot create admins. Helmet, auth rate limiting, Zod validation, allowlisted sort fields and centralized errors provide baseline protections.

The React client uses native controls and an authoritative server timeline rather than a heavy calendar package. Integration tests use Vitest/Supertest for auth, role checks, booking rules (including concurrent booking), search, cancellation and admin updates. CI migrates PostgreSQL then typechecks, lints, tests and builds.

The starting workspace was empty rather than a Git checkout; the named repository was cloned into `work/clinic_appointments` before implementation so workspace support folders were preserved. Runtime verification was not possible in this environment because Node/npm was not installed (`npm` was not recognized); no test result is claimed here.

The lifecycle extension keeps rescheduling as an operation on the same confirmed record, so it retains patient and doctor history while the exclusion constraint protects its new range. Completion and no-show are explicit states. A reusable ClockService processes deterministic supplied timestamps: it converts to clinic time, marks overdue confirmed appointments no-show before reminder selection, inserts idempotent daily reminder records via a unique outbox dedupe key, and gives the evaluator a durable `/outbox` inspection point.

Local verification uses the Docker PostgreSQL service and pnpm workspace scripts. Prisma generation, validation, migrations and the idempotent seed run successfully; the server and client typechecks, linters and tests pass after the migration timestamp exclusion constraint was corrected. Production build and live API lifecycle checks are run from the repository root after setup.
