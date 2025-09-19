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

INSERT INTO "public"."organizations" ("id", "name", "created_at") VALUES
	('ee8acd56-8e50-423a-8f05-15b760322136', 'Ora Property Management', '2025-09-13 02:12:09.821647+00');


--
-- Data for Name: gl_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."gl_accounts" ("id", "buildium_gl_account_id", "account_number", "name", "description", "type", "sub_type", "is_default_gl_account", "default_account_name", "is_contra_account", "is_bank_account", "cash_flow_classification", "exclude_from_cash_balances", "is_active", "buildium_parent_gl_account_id", "is_credit_card_account", "created_at", "updated_at", "sub_accounts", "org_id", "is_security_deposit_liability") VALUES
	('0ebf9038-3997-4d8d-8d44-f0f9c96f6d03', 0, NULL, 'Default Bank Account GL', NULL, 'Asset', NULL, false, NULL, false, false, NULL, false, true, NULL, false, '2025-09-13 01:32:03.852575+00', '2025-09-13 01:32:03.852575+00', '{}', NULL, false),
	('5073d817-78f7-4c20-8559-d2b8c72eb56f', 10407, NULL, 'Trust account', 'For all trust/escrow funds for daily operation of rental properties', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.487+00', '2025-09-13 01:49:52.488+00', '{}', NULL, false),
	('bcc31121-0b04-4467-830e-9bc06a10db99', 10408, NULL, 'Security deposit bank account', 'For all security deposits of rental properties', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.551+00', '2025-09-13 01:49:52.551+00', '{}', NULL, false),
	('cae14155-5b49-4f6b-b37d-2c802a93e862', 10409, NULL, 'Seaport Operating', 'For Seaport Association operating funds', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.585+00', '2025-09-13 01:49:52.585+00', '{}', NULL, false),
	('dce75781-d7e5-4fed-bcad-1fae32f3eab3', 10410, NULL, 'Lincoln Operating', 'For Lincoln Homeowners Association operating funds', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.612+00', '2025-09-13 01:49:52.612+00', '{}', NULL, false),
	('c71ae5b3-825d-4013-9333-d26d06451738', 10411, NULL, 'Seaport Reserve', 'For Seaport Association reserve funds', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.632+00', '2025-09-13 01:49:52.632+00', '{}', NULL, false),
	('47749da5-d576-456c-b9d6-704b47861644', 10412, NULL, 'Lincoln Reserve', 'For Lincoln Homeowners Association reserve funds', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.653+00', '2025-09-13 01:49:52.653+00', '{}', NULL, false),
	('2f5faf1c-8fbf-4999-bbe4-2c30706fd477', 10413, NULL, 'Company checking', 'Company operating funds', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.675+00', '2025-09-13 01:49:52.675+00', '{}', NULL, false),
	('48ac80a0-d084-4216-9fd7-e74aa0d966e6', 10414, NULL, 'Company savings', 'Company savings', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.696+00', '2025-09-13 01:49:52.696+00', '{}', NULL, false),
	('41c9ea4b-34e4-4dbe-b0df-946519f93030', 10415, NULL, 'Rent account', 'Rent account', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.716+00', '2025-09-13 01:49:52.716+00', '{}', NULL, false),
	('382b1014-9198-4b37-9934-a97a6c637971', 10416, NULL, 'Security deposit escrow', 'Security deposit escrow', 'Asset', 'CurrentAsset', false, NULL, false, true, NULL, false, true, NULL, false, '2025-09-13 01:49:52.736+00', '2025-09-13 01:49:52.736+00', '{}', NULL, false),
	('0cdcb91e-1803-48f2-b889-57ff969054ba', 3, NULL, 'Rent Income', 'Rent Income', 'Income', 'Income', true, 'Rent Income', false, false, NULL, false, true, NULL, false, '2025-09-19 00:32:01.802+00', '2025-09-19 00:32:01.802+00', '{}', NULL, false),
	('9b5016a0-6950-4fcf-ac30-2c2ca4037cda', 5, NULL, 'Security Deposit Liability', 'Security Deposit Liability', 'Liability', 'CurrentLiability', true, 'Security Deposit Liability', false, false, NULL, false, true, NULL, false, '2025-09-19 00:46:52.829+00', '2025-09-19 00:46:52.829+00', '{}', NULL, false);


--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."bank_accounts" ("id", "buildium_bank_id", "name", "description", "account_number", "routing_number", "created_at", "updated_at", "is_active", "balance", "buildium_balance", "gl_account", "country", "check_printing_info", "electronic_payments", "last_source", "last_source_ts", "bank_account_type", "org_id") VALUES
	('b83eeae8-e7ec-404b-b730-f3ecd6c5ef04', 10407, 'Trust account', 'For all trust/escrow funds for daily operation of rental properties', '654321', '123456789', '2025-09-13 01:49:52.527+00', '2025-09-13 01:49:52.527+00', true, -1200.00, -1200.00, '5073d817-78f7-4c20-8559-d2b8c72eb56f', 'United States', '{"CheckLayoutType": "Voucher1StubBottomMemo1Signature", "FractionalNumber": "1-1234/567", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "Buildium bank", "BankInformationLine2": "225 Franklin St", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": true, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.527+00', 'checking', NULL),
	('acb701a0-c554-4284-91ff-9b91d3f949e0', 10408, 'Security deposit bank account', 'For all security deposits of rental properties', '654322', '123456789', '2025-09-13 01:49:52.562+00', '2025-09-13 01:49:52.562+00', true, 19150.00, 19150.00, 'bcc31121-0b04-4467-830e-9bc06a10db99', 'United States', '{"CheckLayoutType": "Voucher1StubBottomMemo1Signature", "FractionalNumber": "", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "", "BankInformationLine2": "", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": false, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.562+00', 'checking', NULL),
	('ac427043-26f7-4ccf-8bbe-2d2cf0c2770f', 10409, 'Seaport Operating', 'For Seaport Association operating funds', '654323', '123456789', '2025-09-13 01:49:52.594+00', '2025-09-13 01:49:52.594+00', true, 41835.39, 41835.39, 'cae14155-5b49-4f6b-b37d-2c802a93e862', 'United States', '{"CheckLayoutType": "Voucher2StubBottomMemo1Signature", "FractionalNumber": "1-1234/567", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "Buildium bank", "BankInformationLine2": "225 Franklin St", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": true, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.594+00', 'checking', NULL),
	('ca51b3d3-6515-4cfe-865d-5b92d133e915', 10410, 'Lincoln Operating', 'For Lincoln Homeowners Association operating funds', '654324', '123456789', '2025-09-13 01:49:52.618+00', '2025-09-13 01:49:52.618+00', true, 23250.00, 23250.00, 'dce75781-d7e5-4fed-bcad-1fae32f3eab3', 'United States', '{"CheckLayoutType": "Voucher2StubBottomMemo2Signatures", "FractionalNumber": "1-1234/567", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "Buildium bank", "BankInformationLine2": "225 Franklin St", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": true, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.618+00', 'checking', NULL),
	('0acbfc40-c0e9-4061-b680-3aa60fde05c1', 10411, 'Seaport Reserve', 'For Seaport Association reserve funds', '654322', '123456789', '2025-09-13 01:49:52.638+00', '2025-09-13 01:49:52.638+00', true, 100000.00, 100000.00, 'c71ae5b3-825d-4013-9333-d26d06451738', 'United States', '{"CheckLayoutType": "Voucher2StubBottomMemo1Signature", "FractionalNumber": "", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "", "BankInformationLine2": "", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": false, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.638+00', 'checking', NULL),
	('9fb794ad-ffcc-497b-8fe9-0d8113d0ba0a', 10412, 'Lincoln Reserve', 'For Lincoln Homeowners Association reserve funds', '654325', '123456789', '2025-09-13 01:49:52.659+00', '2025-09-13 01:49:52.659+00', true, 187200.00, 187200.00, '47749da5-d576-456c-b9d6-704b47861644', 'United States', '{"CheckLayoutType": "Voucher2StubBottomMemo1Signature", "FractionalNumber": "", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "", "BankInformationLine2": "", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": false, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.659+00', 'checking', NULL),
	('77b1c0d0-51bd-4c75-af7a-b0cfdb4bff53', 10413, 'Company checking', 'Company operating funds', '12345', '123456789', '2025-09-13 01:49:52.681+00', '2025-09-13 01:49:52.681+00', true, 9533.17, 9533.17, '2f5faf1c-8fbf-4999-bbe4-2c30706fd477', 'United States', '{"CheckLayoutType": "Voucher1StubBottomMemo1Signature", "FractionalNumber": "1-234/567", "SignatureHeading": "VOID AFTER 90 DAYS", "BankInformationLine1": "Buildium bank", "BankInformationLine2": "3 Center Plaza", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": true, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.681+00', 'checking', NULL),
	('8294f1fe-bac2-4dee-945a-a833141ca357', 10414, 'Company savings', 'Company savings', '123456780', '123456789', '2025-09-13 01:49:52.702+00', '2025-09-13 01:49:52.702+00', true, 6953.29, 6953.29, '48ac80a0-d084-4216-9fd7-e74aa0d966e6', 'United States', '{"CheckLayoutType": "Voucher1StubBottomMemo1Signature", "FractionalNumber": "", "SignatureHeading": "", "BankInformationLine1": "", "BankInformationLine2": "", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": false, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.702+00', 'savings', NULL),
	('e24a4ef8-fffd-4c95-b0ee-0dc0cea738c6', 10415, 'Rent account', 'Rent account', '123456781', '123456790', '2025-09-13 01:49:52.722+00', '2025-09-13 01:49:52.722+00', true, 700.00, 700.00, '41c9ea4b-34e4-4dbe-b0df-946519f93030', 'United States', '{"CheckLayoutType": "Voucher1StubBottomMemo1Signature", "FractionalNumber": "1-234/567", "SignatureHeading": "", "BankInformationLine1": "", "BankInformationLine2": "", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": false, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.722+00', 'checking', NULL),
	('6eba0b94-bce0-4ccb-a246-7fea09e99d8d', 10416, 'Security deposit escrow', 'Security deposit escrow', '123456782', '123456791', '2025-09-13 01:49:52.742+00', '2025-09-13 01:49:52.742+00', true, 100.00, 100.00, '382b1014-9198-4b37-9934-a97a6c637971', 'United States', '{"CheckLayoutType": "Voucher1StubBottomMemo1Signature", "FractionalNumber": "1-234/567", "SignatureHeading": "", "BankInformationLine1": "", "BankInformationLine2": "", "BankInformationLine3": "", "BankInformationLine4": "", "BankInformationLine5": "", "CompanyInformationLine1": "", "CompanyInformationLine2": "", "CompanyInformationLine3": "", "CompanyInformationLine4": "", "CompanyInformationLine5": "", "EnableLocalCheckPrinting": false, "EnableRemoteCheckPrinting": false}', '{"DebitMonthlyLimit": 0, "CreditMonthlyLimit": 0, "DebitTransactionLimit": 0, "CreditTransactionLimit": 0, "ResidentEFTConvienceFeeAmount": null, "CreditCardServiceFeePercentage": null, "IsCreditCardServiceFeePaidByResident": null, "ResidentCreditCardConvenienceFeeAmount": null}', 'buildium', '2025-09-13 01:49:52.742+00', 'checking', NULL);


--
-- Data for Name: properties; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."properties" ("id", "name", "structure_description", "address_line1", "address_line2", "address_line3", "city", "state", "postal_code", "buildium_property_id", "rental_owner_ids", "reserve", "year_built", "created_at", "updated_at", "country", "operating_bank_account_id", "primary_owner", "status", "deposit_trust_account_id", "total_units", "is_active", "buildium_created_at", "buildium_updated_at", "rental_type", "total_inactive_units", "total_occupied_units", "total_active_units", "total_vacant_units", "borough", "neighborhood", "longitude", "latitude", "location_verified", "property_type", "management_scope", "service_plan", "active_services", "fee_assignment", "fee_type", "fee_percentage", "management_fee", "billing_frequency", "service_assignment", "org_id") VALUES
	('d4e7250d-86ea-48ee-b788-12a672963439', '123 William Street | John Doe', '', '123 William Street', NULL, NULL, 'New York', 'NY', '10038-3804', 7907, '{}', 0, NULL, '2025-09-13 02:14:51.007037+00', '2025-09-13 18:59:27.204757+00', 'United States', '77b1c0d0-51bd-4c75-af7a-b0cfdb4bff53', NULL, 'Active', NULL, 1, true, NULL, NULL, NULL, 0, 0, 1, 1, 'Manhattan', 'Manhattan', -74.00695220, 40.70917080, true, 'Condo', 'Building', 'Full', '{"Rent Collection",Maintenance,Turnovers,Compliance,"Bill Pay","Condition Reports",Renewals}', 'Building', 'Flat Rate', NULL, 20.00, 'Monthly', 'Property Level', 'ee8acd56-8e50-423a-8f05-15b760322136');


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."units" ("id", "property_id", "unit_number", "unit_size", "market_rent", "address_line1", "address_line2", "address_line3", "city", "state", "postal_code", "country", "unit_bedrooms", "unit_bathrooms", "description", "created_at", "updated_at", "last_inspection_date", "next_inspection_date", "status", "service_start", "service_end", "service_plan", "fee_type", "fee_percent", "management_fee", "fee_frequency", "active_services", "fee_notes", "buildium_unit_id", "buildium_property_id", "unit_type", "is_active", "buildium_created_at", "buildium_updated_at", "building_name", "org_id") VALUES
	('090fb6d0-62bc-427b-8b5f-c60a58a709a0', 'd4e7250d-86ea-48ee-b788-12a672963439', '1A', NULL, NULL, '123 William Street', NULL, NULL, 'New York', 'NY', '10038-3804', 'United States', 'Studio', '1', NULL, '2025-09-13 02:14:51.055+00', '2025-09-13 02:14:52.729795+00', NULL, NULL, 'Vacant', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 21766, 7907, NULL, true, NULL, NULL, NULL, 'ee8acd56-8e50-423a-8f05-15b760322136');


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

INSERT INTO "public"."contacts" ("id", "is_company", "first_name", "last_name", "company_name", "primary_email", "alt_email", "primary_phone", "alt_phone", "date_of_birth", "primary_address_line_1", "primary_address_line_2", "primary_address_line_3", "primary_city", "primary_state", "primary_postal_code", "primary_country", "alt_address_line_1", "alt_address_line_2", "alt_address_line_3", "alt_city", "alt_state", "alt_postal_code", "alt_country", "mailing_preference", "created_at", "updated_at", "display_name", "buildium_contact_id", "user_id") VALUES
	(1, false, 'John', 'Doe', NULL, 'john@test.com', NULL, NULL, NULL, NULL, 'N/A', NULL, NULL, NULL, NULL, '00000', 'United States', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-13 01:46:11.656+00', '2025-09-13 01:46:11.656+00', 'John Doe', NULL, NULL),
	(2, false, NULL, NULL, NULL, 'brandon@managedbyora.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'United States', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-13 15:24:24.152+00', '2025-09-13 18:54:01.060828+00', NULL, NULL, '3edfea4b-a944-4222-9110-9dd3d918f3d6'),
	(3, false, 'John', 'Doe', NULL, 'johndoe123@gmail.com', NULL, NULL, NULL, NULL, '123 William Street', 'Unit 1A', NULL, 'New York', 'NY', '10038-3804', 'United States', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-18 23:14:50.283214+00', '2025-09-18 23:46:04.742617+00', 'John Doe', NULL, NULL),
	(12, false, 'John', 'Doe', NULL, 'johndoe@gmail.com', NULL, NULL, NULL, NULL, '123 William Street', 'Unit 1A', NULL, 'New York', 'NY', '10038-3804', 'United States', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-18 23:46:08.282989+00', '2025-09-18 23:46:08.282989+00', 'John Doe', NULL, NULL);


--
-- Data for Name: gl_import_cursors; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: lease_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease_recurring_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: lease_sync_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: org_memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."org_memberships" ("id", "user_id", "org_id", "role") VALUES
	('5b09142d-e0bd-403d-b832-946cd2d7c160', '3edfea4b-a944-4222-9110-9dd3d918f3d6', 'ee8acd56-8e50-423a-8f05-15b760322136', 'org_manager');


--
-- Data for Name: owners; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."owners" ("id", "management_agreement_start_date", "management_agreement_end_date", "comment", "tax_payer_name1", "tax_payer_name2", "tax_address_line1", "tax_address_line2", "tax_address_line3", "created_at", "updated_at", "etf_account_type", "etf_account_number", "etf_routing_number", "contact_id", "tax_payer_id", "tax_payer_type", "tax_city", "tax_state", "tax_postal_code", "tax_country", "last_contacted", "buildium_owner_id", "is_active", "buildium_created_at", "buildium_updated_at", "tax_include1099", "org_id", "user_id") VALUES
	('1eb989df-b2ef-4a46-9bce-6c40b092a985', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-13 01:46:11.656+00', '2025-09-13 02:14:53.217819+00', NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 53105, true, NULL, NULL, false, 'ee8acd56-8e50-423a-8f05-15b760322136', NULL);


--
-- Data for Name: owners_list_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."owners_list_cache" ("owner_id", "contact_id", "display_name", "primary_email", "primary_phone", "management_agreement_start_date", "management_agreement_end_date", "updated_at") VALUES
	('1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', NULL, NULL, NULL, '2025-09-13 02:14:53.217819+00');


--
-- Data for Name: ownerships; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ownerships" ("id", "property_id", "owner_id", "primary", "ownership_percentage", "disbursement_percentage", "created_at", "updated_at", "total_units", "total_properties", "org_id") VALUES
	('bf6283c6-a0c3-4011-a88d-17833daa69b3', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', true, 100.00, 100.00, '2025-09-13 18:59:27.223+00', '2025-09-13 18:59:27.223+00', 0, 0, 'ee8acd56-8e50-423a-8f05-15b760322136');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("user_id", "full_name", "email", "created_at") VALUES
	('3edfea4b-a944-4222-9110-9dd3d918f3d6', NULL, 'brandon@managedbyora.com', '2025-09-13 01:37:46.255777+00');


--
-- Data for Name: property_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."property_images" ("id", "property_id", "buildium_image_id", "name", "description", "file_type", "file_size", "is_private", "href", "sort_index", "created_at", "updated_at") VALUES
	('36f51bc8-bd46-4d2e-bbfa-59af2527da57', 'd4e7250d-86ea-48ee-b788-12a672963439', 0, 'building.jpeg', NULL, NULL, NULL, false, 'http://localhost:54321/storage/v1/object/public/property-images/d4e7250d-86ea-48ee-b788-12a672963439/2025-09-13T150604195Z-6teevasq6r4.jpeg', 0, '2025-09-19 02:24:10.567+00', '2025-09-19 02:24:10.567+00');


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."staff" ("id", "is_active", "created_at", "updated_at", "buildium_user_id", "role", "user_id", "first_name", "last_name", "email", "phone", "title", "buildium_staff_id") VALUES
	(3, true, '2025-09-13 17:14:34.525+00', '2025-09-13 18:48:35.196561+00', NULL, 'PROPERTY_MANAGER', '3edfea4b-a944-4222-9110-9dd3d918f3d6', 'Brandon', 'Babel', 'brandon@managedbyora.com', NULL, NULL, NULL);


--
-- Data for Name: property_onboarding; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_onboarding_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: property_ownerships_cache; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."property_ownerships_cache" ("ownership_id", "property_id", "owner_id", "contact_id", "display_name", "primary_email", "primary", "ownership_percentage", "disbursement_percentage", "updated_at") VALUES
	('336e0d92-f49c-4f06-9d7d-327df07a4ee0', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 02:14:51.043629+00'),
	('9654a608-7b2c-4c80-a07a-9dafdcbd9b57', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 14:41:07.153855+00'),
	('a9286294-e7d1-46d4-afc8-162041e28400', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 14:50:10.376777+00'),
	('b5a7699b-576a-44b6-8306-4d69ab3517d6', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 14:53:25.887795+00'),
	('8457fcb0-8093-4f55-ad08-47799f531a02', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 14:54:55.834649+00'),
	('27a65ca7-ff09-4360-8a63-8b45460b58c5', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 18:54:48.635108+00'),
	('987d4ab2-3f09-409b-9653-75a954463103', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 18:55:16.80992+00'),
	('bf6283c6-a0c3-4011-a88d-17833daa69b3', 'd4e7250d-86ea-48ee-b788-12a672963439', '1eb989df-b2ef-4a46-9bce-6c40b092a985', 1, 'John Doe', 'john@test.com', true, 100.00, 100.00, '2025-09-13 18:59:27.225855+00');


--
-- Data for Name: property_staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."property_staff" ("property_id", "staff_id", "role", "created_at", "updated_at") VALUES
	('d4e7250d-86ea-48ee-b788-12a672963439', 3, 'PROPERTY_MANAGER', '2025-09-13 18:59:27.245+00', '2025-09-13 18:59:27.245+00');


--
-- Data for Name: reconciliation_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: recurring_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rent_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: settings_gl_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
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

SELECT pg_catalog.setval('"public"."Staff_id_seq"', 3, true);


--
-- Name: contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."contacts_id_seq"', 14, true);


--
-- PostgreSQL database dump complete
--

RESET ALL;
