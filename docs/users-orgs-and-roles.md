Users vs app Users (Supabase)

- Auth users: Stored in `auth.users` and `auth.identities`. Fields such as `id (UID)`, `email`, `phone`, `created_at`, `last_sign_in_at`, and providers live here.
- App profile: Stored in `public.profiles` (1:1 with `auth.users`). Use for editable app-facing profile fields.
- Organizations: Stored in `public.organizations`.
- Memberships and roles: Stored in `public.org_memberships` (`user_id`, `org_id`, `role`) for the primary/highest role, and `public.org_membership_roles` (`user_id`, `org_id`, `role`) for the full set. Roles use `app_role` enum: `platform_admin`, `org_admin`, `org_manager`, `org_staff`, `owner_portal`, `tenant_portal`.

What was added

- `public.profiles` + trigger: New signups automatically get a profile row (`public.handle_new_user` on `auth.users`).
- `public.contacts.user_id`: Lets the app associate a single contact row per auth user (admin API relies on this). Unique when not null.
- `public.users_with_auth` view: Admin-friendly read that joins `auth.users` with `public.profiles` and aggregates memberships and providers.
- `public.is_platform_admin()` helper: Returns true if the current user has a `platform_admin` membership anywhere.

How to manage organizations and roles

- Create orgs in `public.organizations`.
- Assign roles by inserting/updating rows in `public.org_memberships`.
- The app exposes server routes under `/api/admin` that use the service role key:
  - `GET /api/admin/users`: lists auth users with memberships for the UI.
  - `POST /api/admin/memberships`: assigns roles for a user within an org.
  - `GET/POST /api/admin/orgs`: list/create organizations.
  - `POST /api/admin/contacts`: upsert contact info for a user (now backed by `contacts.user_id`).

Notes

- Editing auth-only fields (like `email`) must go through Supabase Auth flows or server-side Admin API. The database source of truth for login is `auth.users`.
- Read combined details from `public.users_with_auth`; write profile/contact/org/roles to your `public.*` tables.
