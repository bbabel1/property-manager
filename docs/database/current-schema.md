# Database Schema Documentation

Generated from live database on 2025-08-26T03:07:25.630Z

## Table: `properties`

| Column | Type | Sample Value | Description |
|--------|------|--------------|-------------|
| id | string | "93fab410-f366-46e6-b2db-64b8f9cd3f21" | |
| name | string | "325 Lexington | Brandon Babel" | |
| structure_description | object | null | |
| address_line1 | string | "325 Lexington Ave" | |
| address_line2 | string | "" | |
| address_line3 | object | null | |
| city | string | "New York" | |
| state | string | "NY" | |
| postal_code | string | "10016" | |
| buildium_property_id | number | 7647 | |
| rental_owner_ids | object | null | |
| reserve | object | null | |
| year_built | number | 2008 | |
| created_at | string | "2025-08-26T00:18:57.763+00:00" | |
| updated_at | string | "2025-08-26T00:18:57.763+00:00" | |
| country | string | "UnitedStates" | |
| rental_sub_type | string | "SingleFamily" | |
| operating_bank_account_id | string | "d279c23e-4ea0-43df-b40f-e76145fe82d5" | |
| primary_owner | object | null | |
| status | string | "Active" | |
| deposit_trust_account_id | object | null | |
| total_units | number | 1 | |
| property_type | object | null | |
| is_active | boolean | true | |
| buildium_created_at | object | null | |
| buildium_updated_at | object | null | |
| rental_type | string | "Residential" | |

## Table: `units`

| Column | Type | Sample Value | Description |
|--------|------|--------------|-------------|
| id | string | "c8d0defa-f9f8-436b-848b-5714683448c8" | |
| property_id | string | "93fab410-f366-46e6-b2db-64b8f9cd3f21" | |
| unit_number | string | "1A" | |
| unit_size | object | null | |
| market_rent | object | null | |
| address_line1 | string | "325 Lexington Ave" | |
| address_line2 | object | null | |
| address_line3 | object | null | |
| city | string | "New York" | |
| state | string | "NY" | |
| postal_code | string | "10016" | |
| country | string | "UnitedStates" | |
| unit_bedrooms | object | null | |
| unit_bathrooms | string | "1" | |
| description | object | null | |
| created_at | string | "2025-08-26T01:42:35.303+00:00" | |
| updated_at | string | "2025-08-26T01:42:35.303+00:00" | |
| last_inspection_date | object | null | |
| next_inspection_date | object | null | |
| status | string | "Vacant" | |
| service_start | object | null | |
| service_end | object | null | |
| service_plan | object | null | |
| fee_type | object | null | |
| fee_percent | object | null | |
| management_fee | object | null | |
| fee_frequency | object | null | |
| active_services | object | null | |
| fee_notes | object | null | |
| buildium_unit_id | number | 20616 | |
| buildium_property_id | number | 7647 | |
| unit_type | string | "Apartment" | |
| square_footage | object | null | |
| is_active | boolean | false | |
| buildium_created_at | object | null | |
| buildium_updated_at | object | null | |

## Table: `bank_accounts`

| Column | Type | Sample Value | Description |
|--------|------|--------------|-------------|
| id | string | "d279c23e-4ea0-43df-b40f-e76145fe82d5" | |
| buildium_bank_id | number | 10407 | |
| name | string | "Trust account" | |
| description | string | "For all trust/escrow funds for daily operation of rental properties" | |
| bank_account_type | string | "checking" | |
| country | string | "US" | |
| account_number | string | "**4321" | |
| routing_number | string | "123456789" | |
| enable_remote_check_printing | boolean | false | |
| enable_local_check_printing | boolean | false | |
| check_layout_type | object | null | |
| signature_heading | object | null | |
| fractional_number | object | null | |
| bank_information_line1 | object | null | |
| bank_information_line2 | object | null | |
| bank_information_line3 | object | null | |
| bank_information_line4 | object | null | |
| bank_information_line5 | object | null | |
| company_information_line1 | object | null | |
| company_information_line2 | object | null | |
| company_information_line3 | object | null | |
| company_information_line4 | object | null | |
| company_information_line5 | object | null | |
| created_at | string | "2025-08-25T19:41:10.961+00:00" | |
| updated_at | string | "2025-08-25T19:41:11.354+00:00" | |

## Table: `buildium_webhook_events`

| Column | Type | Sample Value | Description |
|--------|------|--------------|-------------|
| id | string | "14fb37d2-614a-4167-a3d6-466de333f057" | |
| event_id | string | "test-1756081521139" | |
| event_type | string | "LeaseTransactionCreated" | |
| event_data | object | {"Events":[{"Id":"test-1756081521139","Data":{"test":true,"timestamp":1756081521142},"EntityId":12345,"EventDate":"2025-08-25T00:25:21.139Z","EventType":"LeaseTransactionCreated","EntityType":"LeaseTransaction"}]} | |
| processed | boolean | true | |
| processed_at | string | "2025-08-25T00:25:26.039+00:00" | |
| error_message | object | null | |
| retry_count | number | 0 | |
| max_retries | number | 3 | |
| created_at | string | "2025-08-25T00:25:25.329616+00:00" | |
| updated_at | string | "2025-08-25T00:25:25.329616+00:00" | |

