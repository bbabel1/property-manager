SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: gl_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."gl_accounts" ("id", "buildium_gl_account_id", "account_number", "name", "description", "type", "sub_type", "is_default_gl_account", "default_account_name", "is_contra_account", "is_bank_account", "cash_flow_classification", "exclude_from_cash_balances", "is_active", "buildium_parent_gl_account_id", "is_credit_card_account", "created_at", "updated_at", "sub_accounts", "org_id", "is_security_deposit_liability") VALUES
	('9405b3f2-7121-436d-ac1b-c4ec666a8a5d', 0, NULL, 'Default Bank Account GL', NULL, 'Asset', NULL, false, NULL, false, false, NULL, false, true, NULL, false, '2025-09-19 02:33:01.908933+00', '2025-09-19 02:33:01.908933+00', '{}', NULL, false);


--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: properties; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: appliances; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: appliance_service_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: bill_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buildium_api_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buildium_api_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buildium_sync_status; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buildium_webhook_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: gl_import_cursors; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inspections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vendor_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease_recurring_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: org_memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: owners; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: owners_list_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ownerships; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_images; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_onboarding; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_onboarding_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_ownerships_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_staff; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: reconciliation_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rent_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sync_operations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: task_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: task_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: task_history_files; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tenant_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: transaction_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: unit_images; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: unit_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: work_order_files; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Name: Lease_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."Lease_id_seq"', 1, false);


--
-- Name: Staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."Staff_id_seq"', 1, false);


--
-- Name: contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."contacts_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

RESET ALL;
