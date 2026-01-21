# Property Onboarding Rollout Readiness

This doc fills the non-code gaps for the property onboarding feature: analytics instrumentation, UX validation, support readiness, help content, compliance, and agreement content QA.

## Analytics Instrumentation Spec

- **Owners:** PM (event coverage) + Data/Eng (schema + pipelines). **Home:** `src/lib/onboarding-telemetry.ts` and `/api/telemetry/onboarding`.
- **Baseline properties (all events):** `event`, `onboarding_id`, `property_id`, `org_id`, `user_id`, `status`, `step_name`, `source` (entry point), `outcome`, `error_code`, `duration_ms`, `metadata`.
- **Events (send via `emitOnboardingTelemetry`):**
  - `onboarding_started` — after `POST /api/onboarding`; props: `onboarding_id`, `property_id`, `status`, `source` (new vs resume).
  - `onboarding_step_viewed` — on step mount/change; props: `step_name`, `status`.
  - `onboarding_autosave` — after autosave attempt; props: `step_name`, `outcome: success|error`, `error_code` (network|validation), `duration_ms`.
  - `onboarding_owner_upserted` — owners/save; props: `owner_count`, `signer_count`, `sum_ownership_pct`, `outcome`, `error_code`.
  - `onboarding_unit_upserted` — units/save; props: `unit_count`, `duplicate_unit_number` (bool), `outcome`, `error_code`.
  - `onboarding_finalize` — finalize call; props: `outcome`, `blocking_reasons[]`, `duration_ms`.
  - `agreement_send` — send attempt; props: `template_id|template_name`, `recipient_count`, `idempotency_hit` (bool), `outcome`, `error_code`.
  - `onboarding_resume_clicked` — resume prompt/board click; props: `source` (address_conflict|board|property_page).
  - `onboarding_cancelled` — user cancels; props: `status_at_cancel`, `has_units`, `has_owners`.
  - `buildium_readiness_checked` (P1) — props: `ready` (bool), `missing_codes[]`.
  - `buildium_sync` (P1) — props: `outcome`, `error_code`, `duration_ms`.
- **Funnels:**
  - Core: start → step2 property created → owners valid → units valid → ready_to_send → agreement_sent.
  - Recovery: draft resumed → ready_to_send → agreement_sent.
  - Delivery quality: agreement_send (attempts) → agreement_send success (idempotency hits, failures).
- **Dashboards:** Completion and drop-off by `step_name`, autosave error rate, idempotency hit rate, send failure codes, recovery rate for drafts.

## UX Research + Pilot Feedback

- **Sessions:** 5–10 moderated sessions (property managers/owners); capture screen + audio.
- **Script:** Setup (context), Step 2 creation, owner/signer clarity, bulk units, review/send confidence, cancellation/resume.
- **Metrics:** Time-to-complete, critical errors, SUS-lite, “confidence to send” score, top 5 issues with severity.
- **Pilot:** Enable flag for 1–2 orgs; collect post-send survey (clarity of email, confidence, blocker); review logs weekly.
- **Exit criteria:** No critical blocker; ≥80% “confident to send” in pilot; no high-severity content or consent gaps.

## Support Runbook

- **Top issues:** draft recovery/resume prompt, duplicate address conflict, ownership 100% validation, duplicate unit numbers, agreement resend/idempotency 409, webhook failure surfaced in UI.
- **Troubleshooting:** locate draft by address/org → resume; for duplicates use normalized address and show prompt; fix ownership sum; fix duplicate unit_number; for idempotency 409 confirm recipients + resend flag; for webhook failure retry send or inspect `agreement_send_log`.
- **Known issues list:** maintain active known issues with workarounds in this doc; update weekly until cleared.
- **Escalation:** webhook failures → eng; persistent autosave errors → eng; content/consent questions → PM+Legal; Buildium readiness (P1) → integrations team.
- **Macros/FAQs:** “Resume draft,” “Duplicate address,” “Ownership must sum to 100%,” “Duplicate unit number,” “Agreement already sent/409,” “Resend agreement.”

## Help Content & External Docs

- Ship a short FAQ covering: who signs, how long it takes, what happens after send, how to resend, how to change owners/units, Buildium sync expectations (optional).
- Link “Learn more” in Step 3 (signers) and Step 5 (send) to this FAQ; include reply-to and support contact.
- Keep docs owner in PM/Support; revisit after pilot feedback.

## Compliance & Consent Checklist

- Confirm email/e-sign consent language near Send CTA; include intent-to-sign + record retention note.
- Ensure audit trail: `agreement_send_log` retention policy, recipients, payload, webhook response, idempotency key.
- Avoid logging PII in errors; mask emails in logs where possible.
- Template disclosures reviewed by Legal; retention window documented; access scoped to org admins/managers.

## Agreement Content QA

- Review subject/preview/CTA for clarity and sender identity; include property name/address.
- Pre-send QA: spelling/links, reply-to, mobile rendering, PDF/attachment availability, template placeholders filled.
- Stakeholder sign-off: PM + Legal/Compliance; capture approval date/version in template notes.
