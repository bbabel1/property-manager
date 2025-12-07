# Rollout Checklist (Auth/RLS Hardening)

Pre-deploy
- [ ] DB backup taken and verified.
- [ ] Migrations applied to staging (RLS + jwt claims).
- [ ] Cross-org tests: membership escalation denied; IDOR attempts blocked on tenant/vendor/owner/monthly log.
- [ ] RLS regression: org members can read; non-members blocked; admins can write.
- [ ] JWT refresh: verify tokens now carry `org_roles`, `org_ids`, `preferred_org_id`.

Deploy plan
- Phase 1 fixes shipped behind `DISABLE_MEMBERSHIP_APIS`; monitor 24–48h.
- Phase 2 fixes rolled out in batches (10–20 routes), verifying org guard + filter per route.
- Phase 3 migrations applied (RLS hardening).
- Phase 4 claims live; middleware/guards using org-scoped roles.

Post-deploy
- [ ] Run `npm run test:membership` and `npm run test:security`.
- [ ] Spot-check structured security logs for allow/deny events.
- [ ] Update `docs/supabaseAdmin-audit.md` and `docs/tenant-isolation-ledger.md` with remaining routes.
- [ ] Execute data cleanup steps (`docs/auth-cleanup.md`) for NULL org_ids and role normalization.
