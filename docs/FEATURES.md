# Taskflow

Employee task board and time tracker, plus a platform admin panel. Modeled on the CareerMiner app at `/root/apps/career-miner`, but it is a separate product. Do not change CareerMiner when working on Taskflow.

Public site:

- App: `https://imehsan.com/taskflow`
- API: `https://imehsan.com/taskflow/api`
- Sign in (both roles): `https://imehsan.com/taskflow/login`
- Employee home: `https://imehsan.com/taskflow/dashboard`
- Admin home: `https://imehsan.com/taskflow/admin`

Local ports, bound to `127.0.0.1` only:

- Frontend `3010` → container `3000`
- Backend `8010` → container `8000`
- Postgres `5437` → container `5432`, database `taskflow`, user/password `postgres`/`postgres`

## Stack

- Backend: FastAPI 0.115, SQLAlchemy 2 async + asyncpg, Alembic, Pydantic v2, JWT (`python-jose`), bcrypt. Code is `taskflow/backend/app`.
- Frontend: Next.js 14 App Router, standalone production build, Redux Toolkit, axios, Tailwind. Code is `taskflow/frontend/src`.
- Docker Compose project name `taskflow`. Postgres volume `taskflow_taskflow_postgres`.
- Backend source is bind-mounted (`./backend:/app`) and uvicorn runs with `--reload`. New pip packages are not in that mount. Rebuild `taskflow-backend` after changing `requirements.txt`.
- Frontend is a production image. `NEXT_PUBLIC_BASE_PATH=/taskflow` and `NEXT_PUBLIC_API_URL=https://imehsan.com/taskflow/api` are baked at build time. Rebuild `taskflow-frontend` after any UI change. `next dev` is not what production runs.
- Host has no Node. Typecheck with `docker run --rm -v /root/apps/taskflow/frontend:/app -w /app node:20-alpine ./node_modules/.bin/tsc --noEmit --pretty false`.
- Browser checks used Playwright from the `career-miner-backend` image: `docker run --rm --network host --entrypoint python -v /tmp/script.py:/tmp/script.py career-miner-backend /tmp/script.py`.

JSON from the API is camelCase (`accessToken`, `organizationId`, `assigneeUserId`, `commentCount`). FastAPI `serialization_alias` plus `response_model_by_alias`.

## Auth and roles

One login endpoint, one cookie. `POST /api/auth/login` returns a JWT. The cookie name is `taskflow_token` so it does not collide with CareerMiner. `sub` is the user UUID.

Every user has `role` of `admin` or `employee` and belongs to exactly one organization. The frontend stores the job title as `user.role` and the system role as `user.systemRole`.

`homePath()` in `frontend/src/lib/user.ts` sends admins to `/admin` and employees to `/dashboard`. Layouts enforce it:

- No token → `/login`
- Employee who opens `/admin` → `/dashboard`
- Admin who opens `/dashboard` → `/admin`

`get_current_employee` returns 403 for admins. `get_current_admin` returns 403 for employees. Login itself accepts both roles. Hydration loads tasks and time sessions only for employees, because those list routes 403 admins.

There is no public signup and no seeded demo account. Create the first admin with the interactive command below. Demo files (`demo.py`, `seed.py`, restore-demo) were removed on purpose. Do not recreate `alex@taskflow.dev` / `admin@taskflow.dev`.

## Employee UI

Sidebar: Dashboard, Tasks, Settings, theme, logout. A page-name loader shows while a sidebar link opens. A timer widget sits on the top bar while a timer is running.

- `/dashboard`: last time in/out, today and week hours, current in-progress task, start/stop timer. The timer dropdown lists only `in_progress` tasks.
- `/tasks`: Kanban (`backlog`, `todo`, `in_progress`, `in_review`, `done`). Drag moves a card. Search, priority filter, and “Mine”. Each column has its own sort, recently updated or task name. Plus on a column opens the task modal.
- `/settings`: profile and daily target hours, theme. No demo restore.

Task modal (`frontend/src/components/TaskModal.tsx`):

- Create and edit title, description, status, priority, labels.
- Assignee is a dropdown of active users in the same organization (`GET /api/tasks/assignees`). The backend rejects an assignee from another organization.
- Description and comments use the same rich text toolbar (bold, italic, underline, lists). The editor saves Markdown (`**bold**`, `*italic*`, `++underline++`, `-` and `1.` lists). Older HTML comments are converted to Markdown when they are read. Cards show a short formatted description and a comment-count badge.

Timer (`frontend/src/components/TimerCard.tsx`, `frontend/src/services/screenCapture.ts`):

- Start/stop records a time entry. It does not record video.
- On start, the browser asks to share the screen once. The track stays paused between shots.
- While the timer is open, one JPEG is taken at a random gap of 1 to 10 minutes inclusive and `POST`ed to `/api/screenshots`.
- The shot is linked to the open time entry. Stopping the timer or logging out stops capture.
- `getDisplayMedia` must be called inside the Start click. A later timer cannot call it without a new user gesture, so a refresh does not resume capture until the user starts again.

## Admin UI

Platform admin. An admin manages every organization, not only their own. Nav: Overview, Organizations, People, Tasks, Time logs.

- `/admin`: counts. The screenshots card links to time logs.
- `/admin/organizations`: create an organization. Slug is generated, with a numeric suffix when the name collides. An explicit slug that is taken returns 409.
- `/admin/users`: create an admin or employee and assign them to an organization.
- `/admin/tasks`: Kanban of tasks, the same board as the employee tasks page. Filter by organization or show all. Each column has its own sort, recently updated or task name. Checkboxes select cards for bulk delete. Plus on a column opens a create dialog. Assignee choices are only people in the selected organization. Dragging a card `PATCH`es its status. Each card shows organization name (when viewing all) and a comment-count badge. Clicking a card opens the task editor: title, description, status, priority, assignee (people in that task's organization), labels, and comments. Import opens a dialog: choose a CSV (`task name`, `description`, `assignee email`, `priority`), watch a progress bar, or download a sample CSV. Imported tasks start in Backlog. With an organization selected, every assignee email must belong to it. With all organizations, each task is created in the assignee's organization. Valid rows are saved; invalid rows are listed and skipped.
- `/admin/time`: time logs. Each duration is a dropdown. Opening it fetches screenshots for that time entry and can open a full-size preview.
- `/admin/screenshots` redirects to `/admin/time`.

## Daily email

`app/modules/cron/scheduler.py` starts an APScheduler `AsyncIOScheduler` in the FastAPI lifespan. One job, `daily_hours_email`, runs at `REPORT_HOUR`:`REPORT_MINUTE` in `REPORT_TIMEZONE` (default 23:59 `Asia/Karachi`).

The email is plain text. Recipients are every active admin. The body lists every active user with organization name, the report date, local session times clipped to that calendar day, and logged hours. Open sessions count until now. Users with zero hours are included. A successful `email_logs` row for that subject and recipient skips a second send the same day. If SMTP is missing or there is no active admin, the job logs and does not send. Failures are caught so the scheduler stays up.

SMTP settings live in `taskflow/backend/.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_USE_TLS`). They match the CareerMiner mail account. Do not print the password.

`POST /api/admin/email/send` is an admin-only form endpoint (recipient, subject, content, optional file). The cron job calls `EmailService` directly.

## Create-admin command

Interactive only. No flags.

```bash
docker exec -it taskflow-backend python -m app.modules.commands.create_admin
```

It asks for first name, last name, email, organization, job title (default Administrator), and password twice. It re-asks on invalid input. If the organization name does not exist, it creates it. The same email cannot be created twice. Password minimum is 4 characters, matching the API.

## Data model

UUID primary keys, `timestamptz`. Organization delete cascades to users, tasks, time entries, screenshots, and comments.

- `organizations`: `name`, unique `slug`
- `users`: `organization_id`, unique `email`, `hashed_password`, `first_name`, `last_name`, `role` (`admin`|`employee`), `job_title`, `daily_target_hours`, `is_active`
- `tasks`: org, unique `(organization_id, key)`, title, description, status, priority, `assignee` display name, nullable `assignee_user_id` (ON DELETE SET NULL), labels `text[]`. Next key is max `TF-n` + 1, floor 100, so the first task in an org is `TF-101`.
- `task_comments`: task CASCADE, user SET NULL, `author_name` snapshot, sanitized HTML `body`
- `time_entries`: org, user, task SET NULL, `started_at`, nullable `ended_at`
- `screenshots`: org, user, time entry SET NULL, `stored_path`, `taken_at`
- `email_logs`: subject, content, attachment name, to/from, response, status `success`|`error`

Migrations: `0001_initial`, `0002_task_assignee`, `0003_email_logs`, `0004_task_comments`. `alembic upgrade head` runs on backend container start. `backend/alembic/env.py` imports the models.

Screenshots are files under `/root/apps/taskflow/storage/screenshots`, mounted at `/data/screenshots`. Database stores a relative path `{user_id}/{uuid}.jpg`. Do not store them only in the container writable layer.

## API map

Auth, both roles:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me`

Employee only:

- `GET /api/tasks`
- `GET /api/tasks/assignees`
- `POST /api/tasks` body uses `assigneeUserId`, not a free-text name
- `PUT /api/tasks/{id}`
- `PATCH /api/tasks/{id}` `{ status }` for drag
- `DELETE /api/tasks/{id}`
- `GET|POST /api/tasks/{id}/comments`
- `GET /api/time/sessions`
- `POST /api/time/start` `{ taskId }` only if that task is `in_progress`
- `POST /api/time/stop`
- `POST /api/screenshots` multipart `file` + `takenAt`
- `GET /api/screenshots` and `GET /api/screenshots/{id}/file`

Admin only, prefix `/api/admin`:

- `GET /summary`
- `GET|POST /organizations`
- `GET|POST /users` query `organizationId`
- `GET|POST /tasks` query `organizationId`. Create body: `organizationId`, `assigneeUserId`, title, description, status, priority, labels
- `POST /tasks/import` multipart `file` (CSV) and optional `organizationId`. Columns: task name, description, assignee email, priority. Response: `created` tasks and per-row `errors`.
- `PATCH /tasks/{id}` `{ status }`
- `PUT /tasks/{id}` body: `assigneeUserId`, title, description, status, priority, labels
- `DELETE /tasks/{id}`
- `POST /tasks/bulk-delete` body `{ ids }`. Deletes the tasks that still exist and returns `{ deleted }`.
- `GET|POST /tasks/{id}/comments`
- `GET /time-entries` query `organizationId`, `userId`
- `GET /time-entries/{id}/screenshots` only shots whose `time_entry_id` is that entry
- `GET /screenshots` and `GET /screenshots/{id}/file`
- `POST /email/send`

`GET /health` is unauthenticated.

## Backend layout

`app/main.py` mounts the routers and owns the scheduler lifespan. `app/database.py` commits the request session after a successful yield and rolls back on exception. `EmailService` uses its own session so a log survives even when the caller rolls back.

`app/modules/`: `auth`, `organization`, `task`, `time_entry`, `screenshot`, `admin`, `email`, `cron`, `commands`.

Descriptions and comments are stored as Markdown. `app/core/markdown.py` converts older HTML into that Markdown. `app/core/html.py` still strips scripts and attributes while converting. The editor is `frontend/src/components/RichTextEditor.tsx` (`contentEditable` plus `document.execCommand`). It turns the formatted text into Markdown before saving and renders Markdown on the card, in the editor, and under comments.

Task list responses include `commentCount`. The employee board increments that count in Redux when a comment is posted (`incrementCommentCount`).

## Nginx

File: `/etc/nginx/sites-available/default`. `sites-enabled/default` must stay a symlink to it.

- `location /taskflow/api/` proxies to `http://127.0.0.1:8010/api/` and allows `client_max_body_size 20m` so screenshot uploads are not rejected.
- `location /taskflow/` and `location = /taskflow` both proxy to `http://127.0.0.1:3010`. Do not 301 between `/taskflow` and `/taskflow/`. That loop is what caused `ERR_TOO_MANY_REDIRECTS`.
- `nginx -t` may warn that `imehsan.com` is defined twice on port 80. That warning is pre-existing. Do not reload nginx unless a config edit requires it.
- Postgres stays on `127.0.0.1` only.

## Commands that matter

```bash
cd /root/apps/taskflow
docker compose up -d --build backend frontend
docker exec taskflow-backend alembic upgrade head
docker exec -it taskflow-backend python -m app.modules.commands.create_admin
```

Backend code edits reload by themselves. Frontend edits and new Python packages need an image rebuild.
