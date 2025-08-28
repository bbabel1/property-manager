alter table "public"."contacts" drop constraint "contacts_alt_country_is_valid";

alter table "public"."contacts" drop constraint "contacts_primary_country_is_valid";

alter table "public"."owners" drop constraint "owners_tax_country_is_valid";

drop view if exists "public"."invalid_country_values";

alter type "public"."countries" rename to "countries__old_version_to_be_dropped";

create type "public"."countries" as enum ('Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Republic of the Congo)', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic (Czechia)', 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor (Timor-Leste)', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast (Côte d'Ivoire)', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Korea (North Korea)', 'Korea (South Korea)', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Martinique', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar (Burma)', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'São Tomé and Príncipe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City (Holy See)', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe');

drop type "public"."countries__old_version_to_be_dropped";

alter table "public"."contacts" alter column "alt_country" set data type text using "alt_country"::text;

alter table "public"."contacts" alter column "primary_country" set default 'United States'::text;

alter table "public"."contacts" alter column "primary_country" set data type text using "primary_country"::text;

alter table "public"."lease" alter column "created_at" set default now();

alter table "public"."lease" alter column "updated_at" set default now();

alter table "public"."owners" alter column "tax_country" set data type text using "tax_country"::text;

alter table "public"."properties" alter column "country" set data type character varying(100) using "country"::character varying(100);

alter table "public"."staff" alter column "created_at" set default now();

alter table "public"."staff" alter column "updated_at" set default now();

alter table "public"."units" alter column "country" set data type character varying(100) using "country"::character varying(100);

alter table "public"."vendors" alter column "country" set data type character varying(100) using "country"::character varying(100);

alter table "public"."contacts" add constraint "contacts_alt_country_is_valid" CHECK (is_valid_country(alt_country)) NOT VALID not valid;

alter table "public"."contacts" validate constraint "contacts_alt_country_is_valid";

alter table "public"."contacts" add constraint "contacts_primary_country_is_valid" CHECK (is_valid_country(primary_country)) NOT VALID not valid;

alter table "public"."contacts" validate constraint "contacts_primary_country_is_valid";

alter table "public"."owners" add constraint "owners_tax_country_is_valid" CHECK (is_valid_country(tax_country)) NOT VALID not valid;

alter table "public"."owners" validate constraint "owners_tax_country_is_valid";

create or replace view "public"."invalid_country_values" as  SELECT 'contacts'::text AS table_name,
    (contacts.id)::text AS id,
    'primary_country'::text AS column_name,
    contacts.primary_country AS value
   FROM contacts
  WHERE (NOT is_valid_country(contacts.primary_country))
UNION ALL
 SELECT 'contacts'::text AS table_name,
    (contacts.id)::text AS id,
    'alt_country'::text AS column_name,
    contacts.alt_country AS value
   FROM contacts
  WHERE (NOT is_valid_country(contacts.alt_country))
UNION ALL
 SELECT 'owners'::text AS table_name,
    (owners.id)::text AS id,
    'tax_country'::text AS column_name,
    owners.tax_country AS value
   FROM owners
  WHERE (NOT is_valid_country(owners.tax_country))
UNION ALL
 SELECT 'properties'::text AS table_name,
    (properties.id)::text AS id,
    'country'::text AS column_name,
    properties.country AS value
   FROM properties
  WHERE (NOT is_valid_country((properties.country)::text))
UNION ALL
 SELECT 'units'::text AS table_name,
    (units.id)::text AS id,
    'country'::text AS column_name,
    units.country AS value
   FROM units
  WHERE (NOT is_valid_country((units.country)::text))
UNION ALL
 SELECT 'vendors'::text AS table_name,
    (vendors.id)::text AS id,
    'country'::text AS column_name,
    vendors.country AS value
   FROM vendors
  WHERE (NOT is_valid_country((vendors.country)::text));



