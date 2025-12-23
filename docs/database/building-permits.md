## Building permits + job filings

How to store DOB NOW: Build approved permits (and future filing sources) so they can be related to properties, buildings, and units.

### Tables

- `public.building_permits`: org-scoped permit records with `property_id` (when the org has the property), optional `building_id` (canonical building row), and deduplication on `(org_id, source, job_filing_number, work_permit, sequence_number)`. Includes BIN, BBL, block/lot, location coordinates, key party fields (owner/applicant), high-signal dates (approved/issued/expired), and `metadata jsonb` to retain every source column (e.g., job_filing_number, work_permit, sequence_number, filing_reason, house_no, street_name, borough, lot, bin, block, c_b_no, apt_condo_no_s, work_on_floor, work_type, permittee_s_license_type, applicant_license, applicant_first_name/middle/last, applicant_business_name/address, filing_representative_first/middle/last/business_name, approved_date, issued_date, expired_date, job_description, estimated_job_costs, owner_business_name, owner_name, owner_street_address/city/state/zip_code, permit_status, tracking_number, zip_code, latitude/longitude, community_board, council_district, bbl, census_tract, nta).
- `public.building_permit_units`: optional join table to tag a permit to one or more `units` plus a freeform `unit_reference` when the unit cannot be resolved.

### Integrations + dataset ID

- `nyc_open_data_integrations.dataset_dob_now_approved_permits` stores the Socrata ID (`rbx6-tga4`) per org; defaults to the DOB NOW: Build – Approved Permits dataset.
- `nyc_open_data_integrations.dataset_dob_permit_issuance_old` stores the BIS-era permit issuance dataset (`ipu4-2q9a`) for historical permits; use `source='dob_permit_issuance_old'`.
- `source` is a normalized identifier (`dob_now_build_approved_permits` by default) and `dataset_id` is stored alongside `metadata` to preserve provenance.

### Access control

- RLS limits access to org members (via `is_org_member`) with service-role escape hatches; updated_at is maintained via `set_updated_at`.

### Linking guidance

- Prefer `building_id` for cross-org deduplication and enrichment (PLUTO/HPD/Geoservice), but still store `bin`/`bbl` so permits can be joined to other NYC Open Data feeds even before a building record exists.
- Use `property_id` for tenant isolation and to display permits within the org’s property dashboard; use `building_permit_units` when a filing references specific apartments/floors.

### Sync helper

- `syncBuildingPermitsFromOpenData` (src/lib/building-permit-sync.ts) fetches both DOB NOW: Build – Approved Permits and DOB Permit Issuance (OLD/BIS) by BIN/BBL, then upserts into `building_permits` with full `metadata`. Pass `orgId` plus `propertyId` or `{ bin, bbl }`; it auto-resolves property/building IDs for linking.
