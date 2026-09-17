
# Auriga Clinic Appointments

A full-stack front-desk appointment system for one clinic with multiple doctors. It prevents double booking, handles cancellation fees, and supports fast patient and appointment lookup.

## Stack

React/TypeScript/Vite client, Express/TypeScript API, PostgreSQL + Prisma. `client/` contains the UI and `server/` contains the API, business rules, migration, seed and tests. Express serves `client/dist` in production.

## Setup

Requires Node **20.19+** (Node 22 recommended), pnpm 11, and Docker.

```bash
git clone git@github.com:shamelsk/clinic_appointments.git
cd clinic_appointments
cp .env.example .env
docker compose up -d
pnpm install
pnpm run db:generate
pnpm run db:validate
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

Open `http://localhost:5173`; Vite proxies `/api` to Express on 4000. Variables: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`, `CLINIC_TIMEZONE`, `CLINIC_DAY_START`, `CLINIC_DAY_END`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_RECEPTIONIST_EMAIL`, `DEMO_RECEPTIONIST_PASSWORD`. Use a strong unique JWT secret outside local development.

## Scripts

`pnpm run dev`, `build`, `start`, `test`, `lint`, `typecheck`, `db:generate`, `db:validate`, `db:migrate`, `db:migrate:deploy`, and `db:seed`. `docker compose down` stops PostgreSQL while retaining data.

## Rules and roles

Public registration always creates a `RECEPTIONIST`; the seed script creates the admin. Receptionists book, search, schedule and cancel. Only admins update cancellation policy.

Appointments are **30 minutes**, must start on a **15-minute boundary**, and must be in the future. Active overlap is `newStart < existingEnd && newEnd > existingStart`. PostgreSQL’s partial GiST exclusion constraint is the final concurrency guard; cancelled appointments do not occupy slots. Cancellation `>=` the configured window (default 120 minutes) is free; cancellation `<` it costs the configured fee (default ₹100). Fee and timestamp are permanently stored.

## REST API

Successful responses are `{success:true,...}`; errors are `{success:false,error:{code,message,details?}}`. All non-auth endpoints require authentication.

| Method | Path | Role | Parameters / response |
|---|---|---|---|
| POST | `/api/auth/register` | Public | `name,email,password`; 201 / 409 duplicate |
| POST | `/api/auth/login` | Public | `email,password`; 401 invalid credentials |
| POST | `/api/auth/logout` | Public | Clears cookie |
| GET | `/api/auth/me` | Authenticated | Current safe user |
| GET | `/api/doctors` | Authenticated | Doctors |
| GET | `/api/doctors/:doctorId/schedule?date=YYYY-MM-DD` | Authenticated | Daily timeline |
| GET | `/api/doctors/:doctorId/slots?date=YYYY-MM-DD` | Authenticated | Authoritative slots |
| POST | `/api/patients` | Authenticated | `name,phone,email?`; reuses phone match |
| GET | `/api/patients/search?q=&page=&pageSize=&sortBy=&sortOrder=` | Authenticated | Patients |
| GET | `/api/patients/:patientId` | Authenticated | Patient |
| GET | `/api/appointments` | Authenticated | `doctorId,date,patientQuery,status,page,pageSize,sortBy,sortOrder` |
| POST | `/api/appointments` | Authenticated | `doctorId`, `patientId` or `patient`, `date`, `startTime`; 409 conflict |
| GET | `/api/appointments/:appointmentId` | Authenticated | Details |
| POST | `/api/appointments/:appointmentId/cancel` | Authenticated | Server-calculated fee |
| GET | `/api/dashboard?date=YYYY-MM-DD` | Authenticated | Daily operations |
| GET | `/api/settings` | Authenticated | Current policy |
| PATCH | `/api/settings` | ADMIN | `cancellationWindowMinutes,lateCancellationFee`; 403 receptionist |

Lists use PostgreSQL pagination and return `{items,pagination:{page,pageSize,total,totalPages,hasNext,hasPrevious}}` with page size ≤100. Search is case-insensitive partial patient name/phone matching. Statuses: 400 validation, 401 auth, 403 role, 404 missing resource, 409 conflict.

## Testing, debugging and deployment

Run `pnpm test` after migrations; integration tests cover auth, role boundaries, booking rules including concurrent booking, cancellation state/fee, admin updates and case-insensitive search. `pnpm run build` creates production bundles. Debug API with `pnpm --filter @clinic/server dev`; inspect DB with `pnpm --filter @clinic/server exec prisma studio`.

For Render, provision PostgreSQL and one Node web service, set the variables above, use `pnpm install --frozen-lockfile && pnpm run build` as build command and `pnpm run db:migrate:deploy && pnpm start` as start command. The API binds `0.0.0.0` and `process.env.PORT`. CI runs migration, typecheck, lint, tests and build with PostgreSQL. Do not commit `.env` or secrets.

Future candidates: waitlists and multi-clinic support. Repository: [shamelsk/clinic_appointments](https://github.com/shamelsk/clinic_appointments).

## Lifecycle automation

Confirmed appointments can be rescheduled with `POST /api/appointments/:appointmentId/reschedule` (`{startAt}`), retaining their ID, patient and doctor; the new interval receives the same database conflict protection. `POST /api/appointments/:appointmentId/complete` marks a confirmed appointment completed. Completed, cancelled and no-show appointments cannot be rescheduled or normally cancelled.

`POST /clock` (also `/api/clock`) accepts `{now}` or `{at}` as an ISO timestamp and runs deterministic jobs: overdue confirmed appointments become `NO_SHOW` first, then at or after the local `clinicDayStart`, one reminder is persisted for every remaining confirmed appointment today. `GET /outbox` (also `/api/outbox`) exposes the persisted reminder records. Each reminder’s `REMINDER:<appointment-id>:<local-date>` key prevents duplicates across repeated clock calls.
