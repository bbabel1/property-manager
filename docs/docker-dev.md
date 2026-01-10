# Docker workflow

## Development (host-mounted source)

- Start dev server with container-managed deps and host UID/GID:
  ```bash
  HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose up --build app
  ```
- Source is bind-mounted with `:cached` for macOS/Windows; switch to `:delegated` if writes dominate, or layer Mutagen/Colima volume caching if I/O is slow.
- Node modules and `.next` live in named volumes (`app-node-modules`, `app-next-cache`) to avoid leaking host builds.
- Open a shell for tools/tests inside the container: `docker compose exec app bash` (then run `python ...`, `npm ...`, etc.).

## Production-style run (immutable image)

- Build and run without dev mounts:
  ```bash
  docker compose -f docker-compose.yml up --build app
  ```
- Use `env_file` in `docker-compose.yml` for runtime env; keep secrets out of the image layers.

## Data volumes

- Named volumes are reserved for data (databases, caches). Code stays bind-mounted only in dev; the production image is immutable.

## Notes

- `.dockerignore` excludes node_modules, build output, env files, and Supabase local state to keep images small and secrets out.
- Containers run as your host user when `HOST_UID`/`HOST_GID` are set, preventing root-owned files on your checkout.
