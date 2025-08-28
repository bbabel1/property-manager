// Buildium Data Mappers
// This file contains functions to map between local database format and Buildium API format

import type {
  BuildiumProperty,
  BuildiumPropertyCreate,
  BuildiumUnit,
  BuildiumUnitCreate,
  BuildiumOwner,
  BuildiumOwnerCreate,
  BuildiumVendor,
  BuildiumVendorCreate,
  BuildiumTask,
  BuildiumTaskCreate,
  BuildiumBill,
  BuildiumBillCreate,
  BuildiumBankAccount,
  BuildiumBankAccountCreate,
  BuildiumLease,
  BuildiumLeaseCreate,
  BuildiumSyncStatus
} from '../types/buildium'


// ============================================================================
// COUNTRY MAPPING UTILITIES
// ============================================================================

/**
 * Comprehensive mapping of Buildium country values to database enum values
 * Buildium uses concatenated names (e.g., "UnitedStates") while our enum uses proper spacing
 */
const BUILDIUM_TO_DATABASE_COUNTRY_MAP: Record<string, string> = {
  // Direct matches (no change needed)
  'Afghanistan': 'Afghanistan',
  'Albania': 'Albania',
  'Algeria': 'Algeria',
  'Andorra': 'Andorra',
  'Angola': 'Angola',
  'Argentina': 'Argentina',
  'Armenia': 'Armenia',
  'Australia': 'Australia',
  'Austria': 'Austria',
  'Azerbaijan': 'Azerbaijan',
  'Bahamas': 'Bahamas',
  'Bahrain': 'Bahrain',
  'Bangladesh': 'Bangladesh',
  'Barbados': 'Barbados',
  'Belarus': 'Belarus',
  'Belgium': 'Belgium',
  'Belize': 'Belize',
  'Benin': 'Benin',
  'Bhutan': 'Bhutan',
  'Bolivia': 'Bolivia',
  'Botswana': 'Botswana',
  'Brazil': 'Brazil',
  'Brunei': 'Brunei',
  'Bulgaria': 'Bulgaria',
  'Burundi': 'Burundi',
  'Cambodia': 'Cambodia',
  'Cameroon': 'Cameroon',
  'Canada': 'Canada',
  'Chad': 'Chad',
  'Chile': 'Chile',
  'China': 'China',
  'Colombia': 'Colombia',
  'Comoros': 'Comoros',
  'CostaRica': 'Costa Rica',
  'Croatia': 'Croatia',
  'Cuba': 'Cuba',
  'Cyprus': 'Cyprus',
  'Denmark': 'Denmark',
  'Djibouti': 'Djibouti',
  'Dominica': 'Dominica',
  'Ecuador': 'Ecuador',
  'Egypt': 'Egypt',
  'ElSalvador': 'El Salvador',
  'Eritrea': 'Eritrea',
  'Estonia': 'Estonia',
  'Ethiopia': 'Ethiopia',
  'Fiji': 'Fiji',
  'Finland': 'Finland',
  'France': 'France',
  'Gabon': 'Gabon',
  'Gambia': 'Gambia',
  'Georgia': 'Georgia',
  'Germany': 'Germany',
  'Ghana': 'Ghana',
  'Greece': 'Greece',
  'Grenada': 'Grenada',
  'Guatemala': 'Guatemala',
  'Guinea': 'Guinea',
  'Guyana': 'Guyana',
  'Haiti': 'Haiti',
  'Honduras': 'Honduras',
  'Hungary': 'Hungary',
  'Iceland': 'Iceland',
  'India': 'India',
  'Indonesia': 'Indonesia',
  'Iran': 'Iran',
  'Iraq': 'Iraq',
  'Ireland': 'Ireland',
  'Israel': 'Israel',
  'Italy': 'Italy',
  'Jamaica': 'Jamaica',
  'Japan': 'Japan',
  'Jordan': 'Jordan',
  'Kazakhstan': 'Kazakhstan',
  'Kenya': 'Kenya',
  'Kiribati': 'Kiribati',
  'Kuwait': 'Kuwait',
  'Kyrgyzstan': 'Kyrgyzstan',
  'Laos': 'Laos',
  'Latvia': 'Latvia',
  'Lebanon': 'Lebanon',
  'Lesotho': 'Lesotho',
  'Liberia': 'Liberia',
  'Libya': 'Libya',
  'Liechtenstein': 'Liechtenstein',
  'Lithuania': 'Lithuania',
  'Luxembourg': 'Luxembourg',
  'Madagascar': 'Madagascar',
  'Malawi': 'Malawi',
  'Malaysia': 'Malaysia',
  'Maldives': 'Maldives',
  'Mali': 'Mali',
  'Malta': 'Malta',
  'Mauritania': 'Mauritania',
  'Mauritius': 'Mauritius',
  'Mexico': 'Mexico',
  'Micronesia': 'Micronesia',
  'Moldova': 'Moldova',
  'Monaco': 'Monaco',
  'Mongolia': 'Mongolia',
  'Morocco': 'Morocco',
  'Mozambique': 'Mozambique',
  'Namibia': 'Namibia',
  'Nauru': 'Nauru',
  'Nepal': 'Nepal',
  'Netherlands': 'Netherlands',
  'NewZealand': 'New Zealand',
  'Nicaragua': 'Nicaragua',
  'Niger': 'Niger',
  'Nigeria': 'Nigeria',
  'Norway': 'Norway',
  'Oman': 'Oman',
  'Pakistan': 'Pakistan',
  'Palau': 'Palau',
  'Panama': 'Panama',
  'PapuaNewGuinea': 'Papua New Guinea',
  'Paraguay': 'Paraguay',
  'Peru': 'Peru',
  'Philippines': 'Philippines',
  'Poland': 'Poland',
  'Portugal': 'Portugal',
  'Qatar': 'Qatar',
  'Romania': 'Romania',
  'Russia': 'Russia',
  'Rwanda': 'Rwanda',
  'Samoa': 'Samoa',
  'SanMarino': 'San Marino',
  'SaoTomeandPrincipe': 'São Tomé and Príncipe',
  'SaudiArabia': 'Saudi Arabia',
  'Senegal': 'Senegal',
  'Seychelles': 'Seychelles',
  'SierraLeone': 'Sierra Leone',
  'Singapore': 'Singapore',
  'Slovakia': 'Slovakia',
  'Slovenia': 'Slovenia',
  'SolomonIslands': 'Solomon Islands',
  'Somalia': 'Somalia',
  'SouthAfrica': 'South Africa',
  'SouthSudan': 'South Sudan',
  'Spain': 'Spain',
  'SriLanka': 'Sri Lanka',
  'Sudan': 'Sudan',
  'Suriname': 'Suriname',
  'Sweden': 'Sweden',
  'Switzerland': 'Switzerland',
  'Syria': 'Syria',
  'Taiwan': 'Taiwan',
  'Tajikistan': 'Tajikistan',
  'Tanzania': 'Tanzania',
  'Thailand': 'Thailand',
  'Togo': 'Togo',
  'Tonga': 'Tonga',
  'TrinidadandTobago': 'Trinidad and Tobago',
  'Tunisia': 'Tunisia',
  'Turkey': 'Turkey',
  'Turkmenistan': 'Turkmenistan',
  'Tuvalu': 'Tuvalu',
  'Uganda': 'Uganda',
  'Ukraine': 'Ukraine',
  'UnitedArabEmirates': 'United Arab Emirates',
  'UnitedKingdom': 'United Kingdom',
  'UnitedStates': 'United States',
  'Uruguay': 'Uruguay',
  'Uzbekistan': 'Uzbekistan',
  'Vanuatu': 'Vanuatu',
  'VaticanCity': 'Vatican City (Holy See)',
  'Venezuela': 'Venezuela',
  'Vietnam': 'Vietnam',
  'Yemen': 'Yemen',
  'Zambia': 'Zambia',
  'Zimbabwe': 'Zimbabwe',

  // Special cases and territories
  'AmericanSamoa': 'American Samoa',
  'AntiguaandBarbuda': 'Antigua and Barbuda',
  'BosniaandHerzegovina': 'Bosnia and Herzegovina',
  'BurkinaFaso': 'Burkina Faso',
  'Burma': 'Myanmar (Burma)',
  'CapeVerde': 'Cape Verde',
  'CentralAfricanRepublic': 'Central African Republic',
  'ChristmasIsland': 'Christmas Island',
  'CocosIslands': 'Cocos Islands',
  'CoralSeaIslands': 'Coral Sea Islands',
  'CotedIvoire': 'Ivory Coast (Côte d\'Ivoire)',
  'CzechRepublic': 'Czech Republic (Czechia)',
  'DemocraticRepublicOfTheCongo': 'Democratic Republic of the Congo',
  'DominicanRepublic': 'Dominican Republic',
  'EquatorialGuinea': 'Equatorial Guinea',
  'Eswatini': 'Eswatini',
  'FalklandIslands': 'Falkland Islands',
  'FaroeIslands': 'Faroe Islands',
  'FrenchGuiana': 'French Guiana',
  'FrenchPolynesia': 'French Polynesia',
  'FrenchSouthernandAntarcticLands': 'French Southern and Antarctic Lands',
  'GuineaBissau': 'Guinea-Bissau',
  'HeardIslandandMcDonaldIslands': 'Heard Island and McDonald Islands',
  'HongKong': 'Hong Kong',
  'IsleofMan': 'Isle of Man',
  'JanMayen': 'Jan Mayen',
  'JuandeNovaIsland': 'Juan de Nova Island',
  'MarshallIslands': 'Marshall Islands',
  'Mayotte': 'Mayotte',
  'NetherlandsAntilles': 'Netherlands Antilles',
  'NewCaledonia': 'New Caledonia',
  'Niue': 'Niue',
  'NorfolkIsland': 'Norfolk Island',
  'NorthernMarianaIslands': 'Northern Mariana Islands',
  'PitcairnIslands': 'Pitcairn Islands',
  'PuertoRico': 'Puerto Rico',
  'RepublicOfTheCongo': 'Congo (Republic of the Congo)',
  'SaintHelena': 'Saint Helena',
  'SaintKittsandNevis': 'Saint Kitts and Nevis',
  'SaintLucia': 'Saint Lucia',
  'SaintPierreandMiquelon': 'Saint Pierre and Miquelon',
  'SaintVincentandtheGrenadines': 'Saint Vincent and the Grenadines',
  'SouthGeorgiaandtheSouthSandwichIslands': 'South Georgia and the South Sandwich Islands',
  'TimorLeste': 'East Timor (Timor-Leste)',
  'Tokelau': 'Tokelau',
  'TurksandCaicosIslands': 'Turks and Caicos Islands',
  'VirginIslands': 'Virgin Islands',
  'WallisandFutuna': 'Wallis and Futuna',

  // Territories and disputed areas (mapped to closest match or kept as-is)
  'Akrotiri': 'Akrotiri',
  'Anguilla': 'Anguilla',
  'Antarctica': 'Antarctica',
  'Aruba': 'Aruba',
  'AshmoreandCartierlslands': 'Ashmore and Cartier Islands',
  'Bassasdalndia': 'Bassas da India',
  'Bouvetisland': 'Bouvet Island',
  'BritishIndianOceanTerritory': 'British Indian Ocean Territory',
  'BritishVirginIslands': 'British Virgin Islands',
  'CaymanIslands': 'Cayman Islands',
  'ClippertonIsland': 'Clipperton Island',
  'CookIslands': 'Cook Islands',
  'Dhekelia': 'Dhekelia',
  'EuropaIsland': 'Europa Island',
  'GazaStrip': 'Gaza Strip',
  'Gibraltar': 'Gibraltar',
  'GloriosoIslands': 'Glorioso Islands',
  'Greenland': 'Greenland',
  'Guadeloupe': 'Guadeloupe',
  'Guam': 'Guam',
  'Guernsey': 'Guernsey',
  'Jersey': 'Jersey',
  'Macau': 'Macau',
  'Macedonia': 'North Macedonia',
  'Martinique': 'Martinique',
  'Montserrat': 'Montserrat',
  'NavassaIsland': 'Navassa Island',
  'NorthKorea': 'Korea (North Korea)',
  'SouthKorea': 'Korea (South Korea)',
  'ParacelIslands': 'Paracel Islands',
  'Reunion': 'Réunion',
  'SerbiaandMontenegro': 'Serbia',
  'SpratlyIslands': 'Spratly Islands',
  'Svalbard': 'Svalbard',
  'Swaziland': 'Eswatini',
  'TromelinIsland': 'Tromelin Island',
  'WakeIsland': 'Wake Island',
  'WestBank': 'Palestine',
  'WesternSahara': 'Western Sahara'
}

/**
 * Converts a Buildium country value to the corresponding database enum value
 * 
 * @param buildiumCountry - The country value from Buildium API
 * @returns The corresponding database enum value, or the original value if no mapping found
 * 
 * @example
 * mapCountryFromBuildium('UnitedStates') // Returns 'United States'
 * mapCountryFromBuildium('AntiguaandBarbuda') // Returns 'Antigua and Barbuda'
 * mapCountryFromBuildium('Canada') // Returns 'Canada' (no change needed)
 */
export function mapCountryFromBuildium(buildiumCountry: string | null | undefined): string | null {
  if (!buildiumCountry) {
    return null
  }

  // Check if we have a direct mapping
  const mappedCountry = BUILDIUM_TO_DATABASE_COUNTRY_MAP[buildiumCountry]
  if (mappedCountry) {
    return mappedCountry
  }

  // If no direct mapping found, try to add spaces before capital letters
  // This handles cases where Buildium concatenates words without spaces
  const spacedCountry = buildiumCountry.replace(/([a-z])([A-Z])/g, '$1 $2')
  
  // Check if the spaced version exists in our map
  const spacedMapping = BUILDIUM_TO_DATABASE_COUNTRY_MAP[spacedCountry]
  if (spacedMapping) {
    return spacedMapping
  }

  // If still no match, return the original value
  // This allows for graceful degradation and easy debugging
  console.warn(`⚠️  No country mapping found for Buildium value: "${buildiumCountry}"`)
  return buildiumCountry
}

/**
 * Converts a database enum country value to Buildium format
 * 
 * @param databaseCountry - The country value from our database enum
 * @returns The corresponding Buildium value, or the original value if no mapping found
 * 
 * @example
 * mapCountryToBuildium('United States') // Returns 'UnitedStates'
 * mapCountryToBuildium('Antigua and Barbuda') // Returns 'AntiguaandBarbuda'
 * mapCountryToBuildium('Canada') // Returns 'Canada' (no change needed)
 */
export function mapCountryToBuildium(databaseCountry: string | null | undefined): string | null {
  if (!databaseCountry) {
    return null
  }

  // Create reverse mapping
  const reverseMap: Record<string, string> = {}
  for (const [buildiumKey, databaseValue] of Object.entries(BUILDIUM_TO_DATABASE_COUNTRY_MAP)) {
    reverseMap[databaseValue] = buildiumKey
  }

  // Check if we have a direct reverse mapping
  const mappedCountry = reverseMap[databaseCountry]
  if (mappedCountry) {
    return mappedCountry
  }

  // If no direct mapping found, try to remove spaces
  // This handles cases where our enum has spaces but Buildium doesn't
  const concatenatedCountry = databaseCountry.replace(/\s+/g, '')
  
  // Check if the concatenated version exists in our reverse map
  const concatenatedMapping = reverseMap[concatenatedCountry]
  if (concatenatedMapping) {
    return concatenatedMapping
  }

  // If still no match, return the original value
  console.warn(`⚠️  No reverse country mapping found for database value: "${databaseCountry}"`)
  return databaseCountry
}

// ============================================================================
// ⚠️  IMPORTANT: MAPPER USAGE GUIDELINES
// ============================================================================
/*
CRITICAL: Choose the correct mapper function to avoid missing relationships!

BASIC MAPPERS (DEPRECATED for most use cases):
- mapPropertyFromBuildium() - ❌ Does NOT handle bank account relationships
- mapBankAccountFromBuildium() - ❌ Does NOT handle GL account relationships  
- mapGLAccountFromBuildium() - ❌ Does NOT handle sub_accounts relationships

ENHANCED MAPPERS (RECOMMENDED):
- mapPropertyFromBuildiumWithBankAccount() - ✅ Handles bank account lookup/fetch/create
- mapBankAccountFromBuildiumWithGLAccount() - ✅ Handles GL account lookup/fetch/create
- mapGLAccountFromBuildiumWithSubAccounts() - ✅ Handles sub_accounts lookup/fetch/create

WHEN TO USE WHICH:
- Use BASIC mappers ONLY for:
  * Simple data validation/testing
  * When you explicitly want to ignore relationships
  * Legacy code that you're gradually migrating

- Use ENHANCED mappers for:
  * All production code
  * Scripts that sync data from Buildium
  * Any case where you want complete data integrity
  * New development work

EXAMPLES:
❌ WRONG (will miss relationships):
  const property = mapPropertyFromBuildium(buildiumData)

✅ CORRECT (handles relationships):
  const property = await mapPropertyFromBuildiumWithBankAccount(buildiumData, supabase)

HELPER FUNCTIONS:
- resolveBankAccountId(): Handles bank account lookup/fetch/create process
- resolveGLAccountId(): Handles GL account lookup/fetch/create process
- resolveSubAccounts(): Handles sub_accounts array resolution
*/

// ============================================================================
// DEPRECATION WARNINGS
// ============================================================================

function showDeprecationWarning(functionName: string, enhancedFunction: string) {
  console.warn(`⚠️  DEPRECATION WARNING: ${functionName}() is deprecated for production use.`)
  console.warn(`   Use ${enhancedFunction}() instead to ensure proper relationship handling.`)
  console.warn(`   This will prevent missing bank accounts, GL accounts, and other relationships.`)
}

// ============================================================================
// SUB ACCOUNTS HELPERS
// ============================================================================

/**
 * Helper function to resolve sub_accounts array from Buildium SubAccounts
 * 
 * @param buildiumSubAccounts - Array of Buildium GL account IDs from SubAccounts field
 * @param supabase - Supabase client instance
 * @returns Promise<string[]> - Array of local GL account UUIDs
 * 
 * Process:
 * 1. For each Buildium GL account ID in the SubAccounts array:
 *    - Search gl_accounts table by buildium_gl_account_id
 *    - If found: Collect the local GL account UUID
 *    - If not found: Fetch from Buildium API, create new record, then collect UUID
 * 2. Return array of all collected UUIDs
 */
export async function resolveSubAccounts(
  buildiumSubAccounts: number[] | null | undefined,
  supabase: any
): Promise<string[]> {
  if (!buildiumSubAccounts || buildiumSubAccounts.length === 0) {
    return [];
  }

  const subAccountIds: string[] = [];

  try {
    for (const buildiumGLAccountId of buildiumSubAccounts) {
      console.log(`Resolving sub-account GL account ID: ${buildiumGLAccountId}`);
      
      // Use the existing resolveGLAccountId function to handle each sub-account
      const localGLAccountId = await resolveGLAccountId(buildiumGLAccountId, supabase);
      
      if (localGLAccountId) {
        subAccountIds.push(localGLAccountId);
        console.log(`Added sub-account: ${localGLAccountId}`);
      } else {
        console.warn(`Failed to resolve sub-account GL account ID: ${buildiumGLAccountId}`);
      }
    }

    console.log(`Resolved ${subAccountIds.length} sub-accounts:`, subAccountIds);
    return subAccountIds;

  } catch (error) {
    console.error('Error resolving sub-accounts:', error);
    return [];
  }
}

// ============================================================================
// GL ACCOUNT HELPERS
// ============================================================================

/**
 * Helper function to handle GL account relationships when mapping bank accounts
 * 
 * @param buildiumGLAccountId - The GLAccount.Id from Buildium bank account
 * @param supabase - Supabase client instance
 * @returns Promise<string | null> - The local GL account ID or null if not found/created
 * 
 * Process:
 * 1. Search for existing GL account record using buildium_gl_account_id
 * 2. If found, return the local GL account ID
 * 3. If not found, fetch from Buildium API using glaccounts/{glAccountId}
 * 4. Create GL account record in local database
 * 5. Return the new local GL account ID
 */
export async function resolveGLAccountId(
  buildiumGLAccountId: number | null | undefined,
  supabase: any
): Promise<string | null> {
  if (!buildiumGLAccountId) {
    return null;
  }

  try {
    // Step 1: Search for existing GL account record
    const { data: existingGLAccount, error: searchError } = await supabase
      .from('gl_accounts')
      .select('id')
      .eq('buildium_gl_account_id', buildiumGLAccountId)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching for GL account:', searchError);
      throw searchError;
    }

    if (existingGLAccount) {
      console.log(`Found existing GL account: ${existingGLAccount.id}`);
      return existingGLAccount.id;
    }

    // Step 2: GL account not found, fetch from Buildium API
    console.log(`GL account ${buildiumGLAccountId} not found, fetching from Buildium...`);
    
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/glaccounts/${buildiumGLAccountId}`;
    const response = await fetch(buildiumUrl, {
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch GL account ${buildiumGLAccountId} from Buildium:`, response.status);
      return null;
    }

    const buildiumGLAccount = await response.json();
    console.log('Fetched GL account from Buildium:', buildiumGLAccount);

    // Step 3: Map and create GL account record with sub_accounts resolution
    const localGLAccount = await mapGLAccountFromBuildiumWithSubAccounts(buildiumGLAccount, supabase);
    
    // Add required timestamps
    const now = new Date().toISOString();
    const finalGLAccountData = {
      ...localGLAccount,
      created_at: now,
      updated_at: now
    };

    const { data: newGLAccount, error: createError } = await supabase
      .from('gl_accounts')
      .insert(finalGLAccountData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating GL account:', createError);
      return null;
    }

    console.log(`Created new GL account: ${newGLAccount.id}`);

    // If this new GL account has a parent in Buildium, try to append this child
    // to the local parent's sub_accounts array (if the parent already exists locally).
    try {
      const parentBuildiumId = buildiumGLAccount?.ParentGLAccountId as number | null | undefined;
      if (parentBuildiumId) {
        const { data: parentAccount, error: parentFetchError } = await supabase
          .from('gl_accounts')
          .select('id, sub_accounts')
          .eq('buildium_gl_account_id', parentBuildiumId)
          .single();

        if (!parentFetchError && parentAccount) {
          const existingSubs: string[] = Array.isArray(parentAccount.sub_accounts) ? parentAccount.sub_accounts : [];
          if (!existingSubs.includes(newGLAccount.id)) {
            const updatedSubs = [...existingSubs, newGLAccount.id];
            const { error: parentUpdateError } = await supabase
              .from('gl_accounts')
              .update({ sub_accounts: updatedSubs, updated_at: now })
              .eq('id', parentAccount.id);

            if (parentUpdateError) {
              console.warn('Failed to update parent sub_accounts for GL account:', parentUpdateError);
            } else {
              console.log(`Updated parent GL account ${parentAccount.id} sub_accounts to include ${newGLAccount.id}`);
            }
          }
        }
      }
    } catch (parentLinkErr) {
      console.warn('Non-fatal: error linking GL account to parent sub_accounts:', parentLinkErr);
    }
    return newGLAccount.id;

  } catch (error) {
    console.error('Error resolving GL account ID:', error);
    return null;
  }
}

// ============================================================================
// BANK ACCOUNT HELPERS
// ============================================================================

/**
 * Helper function to handle bank account relationships when mapping properties
 * 
 * @param buildiumOperatingBankAccountId - The OperatingBankAccountId from Buildium property
 * @param supabase - Supabase client instance
 * @returns Promise<string | null> - The local bank account ID or null if not found/created
 * 
 * Process:
 * 1. Search for existing bank account record using buildium_bank_id
 * 2. If found, return the local bank account ID
 * 3. If not found, fetch from Buildium API using bankaccounts/{bankAccountId}
 * 4. Create bank account record in local database
 * 5. Return the new local bank account ID
 */
export async function resolveBankAccountId(
  buildiumOperatingBankAccountId: number | null | undefined,
  supabase: any
): Promise<string | null> {
  if (!buildiumOperatingBankAccountId) {
    return null;
  }

  try {
    // Step 1: Search for existing bank account record
    const { data: existingBankAccount, error: searchError } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('buildium_bank_id', buildiumOperatingBankAccountId)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching for bank account:', searchError);
      throw searchError;
    }

    if (existingBankAccount) {
      console.log(`Found existing bank account: ${existingBankAccount.id}`);
      return existingBankAccount.id;
    }

    // Step 2: Bank account not found, fetch from Buildium API
    console.log(`Bank account ${buildiumOperatingBankAccountId} not found, fetching from Buildium...`);
    
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bankaccounts/${buildiumOperatingBankAccountId}`;
    const response = await fetch(buildiumUrl, {
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch bank account ${buildiumOperatingBankAccountId} from Buildium:`, response.status);
      return null;
    }

    const buildiumBankAccount = await response.json();
    console.log('Fetched bank account from Buildium:', buildiumBankAccount);

    // Step 3: Map and create bank account record with GL account resolution
    const localBankAccount = await mapBankAccountFromBuildiumWithGLAccount(buildiumBankAccount, supabase);
    
    // Add required timestamps
    const now = new Date().toISOString();
    const finalBankAccountData = {
      ...localBankAccount,
      created_at: now,
      updated_at: now
    };

    const { data: newBankAccount, error: createError } = await supabase
      .from('bank_accounts')
      .insert(finalBankAccountData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating bank account:', createError);
      return null;
    }

    console.log(`Created new bank account: ${newBankAccount.id}`);
    return newBankAccount.id;

  } catch (error) {
    console.error('Error resolving bank account ID:', error);
    return null;
  }
}

// ============================================================================
// PROPERTY MAPPERS
// ============================================================================

export function mapPropertyToBuildium(localProperty: any): BuildiumPropertyCreate {
  return {
    Name: localProperty.name,
    StructureDescription: localProperty.structure_description || undefined,
    NumberUnits: localProperty.number_units || undefined,
    IsActive: localProperty.is_active !== false,
    OperatingBankAccountId: localProperty.operating_bank_account_id || undefined,
    Reserve: localProperty.reserve || undefined,
    Address: {
      AddressLine1: localProperty.address_line1,
      AddressLine2: localProperty.address_line2 || undefined,
      AddressLine3: localProperty.address_line3 || undefined,
      City: localProperty.city || '',
      State: localProperty.state || '',
      PostalCode: localProperty.postal_code,
      Country: mapCountryToBuildium(localProperty.country) || ''
    },
    YearBuilt: localProperty.year_built || undefined,
    RentalType: localProperty.rental_type || 'Rental',
    RentalSubType: localProperty.rental_sub_type || 'SingleFamily',
    RentalManager: localProperty.rental_manager || undefined
  }
}

/**
 * @deprecated Use mapPropertyFromBuildiumWithBankAccount() instead to ensure proper bank account relationship handling
 * This basic mapper does NOT handle bank account relationships and will result in missing data
 */
export function mapPropertyFromBuildium(buildiumProperty: BuildiumProperty): any {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    showDeprecationWarning('mapPropertyFromBuildium', 'mapPropertyFromBuildiumWithBankAccount')
  }
  
  return {
    name: buildiumProperty.Name,
    rental_type: buildiumProperty.RentalType,
    rental_sub_type: buildiumProperty.RentalSubType,
    address_line1: buildiumProperty.Address.AddressLine1,
    address_line2: buildiumProperty.Address.AddressLine2,
    city: buildiumProperty.Address.City,
    state: buildiumProperty.Address.State,
    postal_code: buildiumProperty.Address.PostalCode,
    country: mapCountryFromBuildium(buildiumProperty.Address.Country) || 'United States',
    year_built: buildiumProperty.YearBuilt,
    is_active: buildiumProperty.IsActive,
    // Note: Description field doesn't exist in BuildiumProperty
    buildium_property_id: buildiumProperty.Id,
    buildium_created_at: buildiumProperty.CreatedDate,
    buildium_updated_at: buildiumProperty.ModifiedDate,
    updated_at: new Date().toISOString()
    // Note: operating_bank_account_id will be resolved separately using resolveBankAccountId()
  }
}

/**
 * Enhanced property mapping that includes bank account resolution
 * Use this function when you need to handle bank account relationships
 */
export async function mapPropertyFromBuildiumWithBankAccount(
  buildiumProperty: BuildiumProperty,
  supabase: any
): Promise<any> {
  const baseProperty = mapPropertyFromBuildium(buildiumProperty);
  
  // Resolve bank account ID if OperatingBankAccountId exists
  const operatingBankAccountId = await resolveBankAccountId(
    buildiumProperty.OperatingBankAccountId,
    supabase
  );

  return {
    ...baseProperty,
    operating_bank_account_id: operatingBankAccountId
  };
}

// ============================================================================
// UNIT MAPPERS
// ============================================================================

export function mapUnitToBuildium(localUnit: any): BuildiumUnitCreate {
  return {
    PropertyId: localUnit.buildium_property_id || localUnit.property_id,
    UnitType: mapUnitTypeToBuildium(localUnit.unit_type || 'Apartment'),
    Number: localUnit.unit_number || localUnit.number || '',
    SquareFootage: localUnit.square_footage || undefined,
    Bedrooms: localUnit.bedrooms || undefined,
    Bathrooms: localUnit.bathrooms || undefined,
    IsActive: localUnit.is_active !== false
    // Note: Description, RentAmount, SecurityDepositAmount fields don't exist in BuildiumUnitCreate
  }
}

export function mapUnitFromBuildium(buildiumUnit: BuildiumUnit): any {
  return {
    buildium_unit_id: buildiumUnit.Id,
    buildium_property_id: buildiumUnit.PropertyId,
    building_name: buildiumUnit.BuildingName,
    unit_number: buildiumUnit.UnitNumber,
    description: buildiumUnit.Description,
    market_rent: buildiumUnit.MarketRent,
    address_line1: buildiumUnit.Address?.AddressLine1,
    address_line2: buildiumUnit.Address?.AddressLine2,
    address_line3: buildiumUnit.Address?.AddressLine3,
    city: buildiumUnit.Address?.City,
    state: buildiumUnit.Address?.State,
    postal_code: buildiumUnit.Address?.PostalCode,
    country: mapCountryFromBuildium(buildiumUnit.Address?.Country),
    unit_bedrooms: mapBedroomsFromBuildium(buildiumUnit.UnitBedrooms),
    unit_bathrooms: mapBathroomsFromBuildium(buildiumUnit.UnitBathrooms),
    unit_size: buildiumUnit.UnitSize
  }
}

function mapBedroomsFromBuildium(buildiumBedrooms: string | null | undefined): string | null {
  if (!buildiumBedrooms) return null
  
  switch (buildiumBedrooms) {
    case 'Studio': return 'Studio'
    case 'OneBed': return '1'
    case 'TwoBed': return '2'
    case 'ThreeBed': return '3'
    case 'FourBed': return '4'
    case 'FiveBed': return '5+'
    case 'SixBed': return '6'
    case 'SevenBed': return '7'
    case 'EightBed': return '8'
    case 'NineBedPlus': return '9+'
    default: return null
  }
}

function mapBathroomsFromBuildium(buildiumBathrooms: string | null | undefined): string | null {
  if (!buildiumBathrooms) return null
  
  switch (buildiumBathrooms) {
    case 'OneBath': return '1'
    case 'OnePointFiveBath': return '1.5'
    case 'TwoBath': return '2'
    case 'TwoPointFiveBath': return '2.5'
    case 'ThreeBath': return '3'
    case 'ThreePointFiveBath': return '3.5'
    case 'FourBath': return '4+'
    case 'FourPointFiveBath': return '4.5'
    case 'FiveBath': return '5'
    case 'FivePlusBath': return '5+'
    default: return null
  }
}

function mapUnitTypeToBuildium(localType: string): 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other' {
  switch (localType?.toLowerCase()) {
    case 'apartment':
      return 'Apartment'
    case 'condo':
    case 'condominium':
      return 'Condo'
    case 'house':
      return 'House'
    case 'townhouse':
      return 'Townhouse'
    case 'office':
      return 'Office'
    case 'retail':
      return 'Retail'
    case 'warehouse':
      return 'Warehouse'
    default:
      return 'Other'
  }
}

function mapUnitTypeFromBuildium(buildiumType: 'Apartment' | 'Condo' | 'House' | 'Townhouse' | 'Office' | 'Retail' | 'Warehouse' | 'Other'): string {
  switch (buildiumType) {
    case 'Condo':
      return 'condo'
    case 'House':
      return 'house'
    case 'Townhouse':
      return 'townhouse'
    case 'Office':
      return 'office'
    case 'Retail':
      return 'retail'
    case 'Warehouse':
      return 'warehouse'
    case 'Other':
      return 'other'
    default:
      return 'apartment'
  }
}

// ============================================================================
// OWNER MAPPERS
// ============================================================================

export function mapOwnerToBuildium(localOwner: any): BuildiumOwnerCreate {
  return {
    FirstName: localOwner.first_name,
    LastName: localOwner.last_name,
    Email: localOwner.email,
    PhoneNumber: localOwner.phone_number || undefined,
    Address: {
      AddressLine1: localOwner.address_line1,
      AddressLine2: localOwner.address_line2 || undefined,
      City: localOwner.city || '',
      State: localOwner.state || '',
      PostalCode: localOwner.postal_code,
      Country: mapCountryToBuildium(localOwner.country) || ''
    },
    TaxId: localOwner.tax_id || undefined,
    IsActive: localOwner.is_active !== false
  }
}

export function mapOwnerFromBuildium(buildiumOwner: BuildiumOwner): any {
  return {
    first_name: buildiumOwner.FirstName,
    last_name: buildiumOwner.LastName,
    email: buildiumOwner.Email,
    phone_number: buildiumOwner.PhoneNumber,
    address_line1: buildiumOwner.Address.AddressLine1,
    address_line2: buildiumOwner.Address.AddressLine2,
    city: buildiumOwner.Address.City,
    state: buildiumOwner.Address.State,
    postal_code: buildiumOwner.Address.PostalCode,
    country: mapCountryFromBuildium(buildiumOwner.Address.Country) || 'United States',
    tax_id: buildiumOwner.TaxId,
    is_active: buildiumOwner.IsActive,
    buildium_owner_id: buildiumOwner.Id,
    buildium_created_at: buildiumOwner.CreatedDate,
    buildium_updated_at: buildiumOwner.ModifiedDate
  }
}

// ============================================================================
// VENDOR MAPPERS
// ============================================================================

export function mapVendorToBuildium(localVendor: any): BuildiumVendorCreate {
  return {
    Name: localVendor.name,
    CategoryId: localVendor.category_id,
    ContactName: localVendor.contact_name || undefined,
    Email: localVendor.email || undefined,
    PhoneNumber: localVendor.phone_number || undefined,
    Address: {
      AddressLine1: localVendor.address_line1,
      AddressLine2: localVendor.address_line2 || undefined,
      City: localVendor.city || '',
      State: localVendor.state || '',
      PostalCode: localVendor.postal_code,
      Country: mapCountryToBuildium(localVendor.country) || ''
    },
    TaxId: localVendor.tax_id || undefined,
    Notes: localVendor.notes || undefined,
    IsActive: localVendor.is_active !== false
  }
}

export function mapVendorFromBuildium(buildiumVendor: BuildiumVendor): any {
  return {
    name: buildiumVendor.Name,
    category_id: buildiumVendor.CategoryId,
    contact_name: buildiumVendor.ContactName,
    email: buildiumVendor.Email,
    phone_number: buildiumVendor.PhoneNumber,
    address_line1: buildiumVendor.Address.AddressLine1,
    address_line2: buildiumVendor.Address.AddressLine2,
    city: buildiumVendor.Address.City,
    state: buildiumVendor.Address.State,
    postal_code: buildiumVendor.Address.PostalCode,
    country: mapCountryFromBuildium(buildiumVendor.Address.Country) || 'United States',
    tax_id: buildiumVendor.TaxId,
    notes: buildiumVendor.Notes,
    is_active: buildiumVendor.IsActive,
    buildium_vendor_id: buildiumVendor.Id,
    buildium_created_at: buildiumVendor.CreatedDate,
    buildium_updated_at: buildiumVendor.ModifiedDate
  }
}

// ============================================================================
// TASK MAPPERS
// ============================================================================

export function mapTaskToBuildium(localTask: any): BuildiumTaskCreate {
  return {
    PropertyId: localTask.buildium_property_id || localTask.property_id,
    UnitId: localTask.buildium_unit_id || localTask.unit_id || undefined,
    Subject: localTask.title,
    Description: localTask.description || undefined,
    Category: localTask.category_id,
    Priority: mapTaskPriorityToBuildium(localTask.priority || 'Medium'),
    Status: mapTaskStatusToBuildium(localTask.status || 'Open'),
    AssignedTo: localTask.assigned_to_id || undefined
  }
}

export function mapTaskFromBuildium(buildiumTask: BuildiumTask): any {
  return {
    property_id: buildiumTask.PropertyId,
    unit_id: buildiumTask.UnitId,
    title: buildiumTask.Subject,
    description: buildiumTask.Description,
    category_id: buildiumTask.Category,
    priority: mapTaskPriorityFromBuildium(buildiumTask.Priority),
    status: mapTaskStatusFromBuildium(buildiumTask.Status),
    assigned_to_id: buildiumTask.AssignedTo,
    buildium_task_id: buildiumTask.Id,
    buildium_created_at: buildiumTask.CreatedDate,
    buildium_updated_at: buildiumTask.ModifiedDate
  }
}

function mapTaskPriorityToBuildium(localPriority: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  switch (localPriority?.toLowerCase()) {
    case 'low':
      return 'Low'
    case 'high':
      return 'High'
    case 'critical':
      return 'Critical'
    default:
      return 'Medium'
  }
}

function mapTaskPriorityFromBuildium(buildiumPriority: 'Low' | 'Medium' | 'High' | 'Critical'): string {
  switch (buildiumPriority) {
    case 'Low':
      return 'low'
    case 'High':
      return 'high'
    case 'Critical':
      return 'critical'
    default:
      return 'medium'
  }
}

function mapTaskStatusToBuildium(localStatus: string): 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold' {
  switch (localStatus?.toLowerCase()) {
    case 'in_progress':
    case 'inprogress':
      return 'InProgress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'on_hold':
    case 'onhold':
      return 'OnHold'
    default:
      return 'Open'
  }
}

function mapTaskStatusFromBuildium(buildiumStatus: 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold'): string {
  switch (buildiumStatus) {
    case 'InProgress':
      return 'in_progress'
    case 'Completed':
      return 'completed'
    case 'Cancelled':
      return 'cancelled'
    case 'OnHold':
      return 'on_hold'
    default:
      return 'open'
  }
}

// ============================================================================
// BILL MAPPERS
// ============================================================================

export function mapBillToBuildium(localBill: any): BuildiumBillCreate {
  return {
    PropertyId: localBill.buildium_property_id || localBill.property_id,
    UnitId: localBill.buildium_unit_id || localBill.unit_id || undefined,
    VendorId: localBill.buildium_vendor_id || localBill.vendor_id,
    Date: localBill.bill_date,
    Description: localBill.description || undefined,
    Amount: localBill.amount,
    DueDate: localBill.due_date,
    CategoryId: localBill.category_id || undefined
  }
}

export function mapBillFromBuildium(buildiumBill: BuildiumBill): any {
  return {
    property_id: buildiumBill.PropertyId,
    unit_id: buildiumBill.UnitId,
    vendor_id: buildiumBill.VendorId,
    bill_date: buildiumBill.Date,
    description: buildiumBill.Description,
    amount: buildiumBill.Amount,
    due_date: buildiumBill.DueDate,
    category_id: buildiumBill.CategoryId,
    status: mapBillStatusFromBuildium(buildiumBill.Status),
    buildium_bill_id: buildiumBill.Id,
    buildium_created_at: buildiumBill.CreatedDate,
    buildium_updated_at: buildiumBill.ModifiedDate
  }
}

function mapBillStatusToBuildium(localStatus: string): 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid' {
  switch (localStatus?.toLowerCase()) {
    case 'paid':
      return 'Paid'
    case 'overdue':
      return 'Overdue'
    case 'cancelled':
      return 'Cancelled'
    case 'partially_paid':
    case 'partiallypaid':
      return 'PartiallyPaid'
    default:
      return 'Pending'
  }
}

function mapBillStatusFromBuildium(buildiumStatus: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled' | 'PartiallyPaid'): string {
  switch (buildiumStatus) {
    case 'PartiallyPaid':
      return 'partially_paid'
    default:
      return buildiumStatus.toLowerCase()
  }
}

// ============================================================================
// GL ACCOUNT MAPPERS
// ============================================================================

export function mapGLAccountToBuildium(localGLAccount: any): any {
  return {
    Name: localGLAccount.name,
    Description: localGLAccount.description || undefined,
    Type: localGLAccount.type,
    SubType: localGLAccount.sub_type || undefined,
    IsDefaultGLAccount: localGLAccount.is_default_gl_account || false,
    DefaultAccountName: localGLAccount.default_account_name || undefined,
    IsContraAccount: localGLAccount.is_contra_account || false,
    IsBankAccount: localGLAccount.is_bank_account || false,
    CashFlowClassification: localGLAccount.cash_flow_classification || undefined,
    ExcludeFromCashBalances: localGLAccount.exclude_from_cash_balances || false,
    IsActive: localGLAccount.is_active !== false,
    ParentGLAccountId: localGLAccount.buildium_parent_gl_account_id || undefined,
    IsCreditCardAccount: localGLAccount.is_credit_card_account || false
  }
}

/**
 * @deprecated Use mapGLAccountFromBuildiumWithSubAccounts() instead to ensure proper sub_accounts relationship handling
 * This basic mapper does NOT handle sub_accounts relationships and will result in missing data
 */
export function mapGLAccountFromBuildium(buildiumGLAccount: any): any {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    showDeprecationWarning('mapGLAccountFromBuildium', 'mapGLAccountFromBuildiumWithSubAccounts')
  }
  return {
    buildium_gl_account_id: buildiumGLAccount.Id,
    account_number: buildiumGLAccount.AccountNumber,
    name: buildiumGLAccount.Name,
    description: buildiumGLAccount.Description,
    type: buildiumGLAccount.Type,
    sub_type: buildiumGLAccount.SubType,
    is_default_gl_account: buildiumGLAccount.IsDefaultGLAccount,
    default_account_name: buildiumGLAccount.DefaultAccountName,
    is_contra_account: buildiumGLAccount.IsContraAccount,
    is_bank_account: buildiumGLAccount.IsBankAccount,
    cash_flow_classification: buildiumGLAccount.CashFlowClassification,
    exclude_from_cash_balances: buildiumGLAccount.ExcludeFromCashBalances,
    is_active: buildiumGLAccount.IsActive,
    buildium_parent_gl_account_id: buildiumGLAccount.ParentGLAccountId,
    is_credit_card_account: buildiumGLAccount.IsCreditCardAccount
    // Note: sub_accounts will be resolved separately using resolveSubAccounts()
  }
}

/**
 * Enhanced GL account mapping that includes sub_accounts resolution
 * Use this function when you need to handle sub_accounts relationships
 */
export async function mapGLAccountFromBuildiumWithSubAccounts(
  buildiumGLAccount: any,
  supabase: any
): Promise<any> {
  const baseGLAccount = mapGLAccountFromBuildium(buildiumGLAccount);
  
  // Resolve sub_accounts array if SubAccounts exists
  const subAccounts = await resolveSubAccounts(
    buildiumGLAccount.SubAccounts,
    supabase
  );

  return {
    ...baseGLAccount,
    sub_accounts: subAccounts
  };
}

// ============================================================================
// BANK ACCOUNT MAPPERS
// ============================================================================

export function mapBankAccountToBuildium(localBankAccount: any): BuildiumBankAccountCreate {
  return {
    Name: localBankAccount.name,
    BankAccountType: mapBankAccountTypeToBuildium(localBankAccount.bank_account_type || 'Checking'),
    AccountNumber: localBankAccount.account_number,
    RoutingNumber: localBankAccount.routing_number,
    Description: localBankAccount.description || undefined,
    IsActive: localBankAccount.is_active !== false
  }
}

/**
 * Basic bank account mapping (does NOT handle GL account relationships)
 * @deprecated Use mapBankAccountFromBuildiumWithGLAccount() instead to ensure proper GL account relationship handling
 * This basic mapper does NOT handle GL account relationships and will result in missing data
 */
export function mapBankAccountFromBuildium(buildiumBankAccount: any): any {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    showDeprecationWarning('mapBankAccountFromBuildium', 'mapBankAccountFromBuildiumWithGLAccount')
  }
  return {
    buildium_bank_id: buildiumBankAccount.Id,
    name: buildiumBankAccount.Name,
    description: buildiumBankAccount.Description,
    bank_account_type: mapBankAccountTypeFromBuildium(buildiumBankAccount.BankAccountType),
    account_number: buildiumBankAccount.AccountNumberUnmasked, // Use unmasked account number
    routing_number: buildiumBankAccount.RoutingNumber,
    is_active: buildiumBankAccount.IsActive,
    buildium_balance: buildiumBankAccount.Balance
    // Note: gl_account will be resolved separately using resolveGLAccountId()
    // Note: Check printing and information fields were removed from database schema
  }
}

/**
 * Enhanced bank account mapping that includes GL account resolution
 * Use this function when you need to handle GL account relationships
 */
export async function mapBankAccountFromBuildiumWithGLAccount(
  buildiumBankAccount: any,
  supabase: any
): Promise<any> {
  const baseBankAccount = mapBankAccountFromBuildium(buildiumBankAccount);
  
  // Resolve GL account ID if GLAccount.Id exists
  const glAccountId = await resolveGLAccountId(
    buildiumBankAccount.GLAccount?.Id,
    supabase
  );

  return {
    ...baseBankAccount,
    gl_account: glAccountId
  };
}

function mapBankAccountTypeToBuildium(localType: string): 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit' {
  switch (localType?.toLowerCase()) {
    case 'savings':
      return 'Savings'
    case 'money_market':
    case 'moneymarket':
      return 'MoneyMarket'
    case 'certificate_of_deposit':
    case 'certificateofdeposit':
      return 'CertificateOfDeposit'
    default:
      return 'Checking'
  }
}

function mapBankAccountTypeFromBuildium(buildiumType: 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit'): string {
  switch (buildiumType) {
    case 'MoneyMarket':
      return 'money_market'
    case 'CertificateOfDeposit':
      return 'certificate_of_deposit'
    default:
      return buildiumType.toLowerCase()
  }
}

// ============================================================================
// LEASE MAPPERS
// ============================================================================

export function mapLeaseToBuildium(localLease: any): any {
  return {
    PropertyId: localLease.buildium_property_id || localLease.property_id,
    UnitId: localLease.buildium_unit_id || localLease.unit_id,
    LeaseStatus: localLease.status || 'Active',
    LeaseFromDate: localLease.lease_from_date,
    LeaseToDate: localLease.lease_to_date || undefined,
    LeaseType: localLease.lease_type || undefined,
    TermType: localLease.term_type || undefined,
    RenewalOfferStatus: localLease.renewal_offer_status || undefined,
    CurrentNumberOfOccupants: localLease.current_number_of_occupants || undefined,
    IsEvictionPending: localLease.is_eviction_pending || false,
    AutomaticallyMoveOutTenants: localLease.automatically_move_out_tenants || false,
    PaymentDueDay: localLease.payment_due_day || undefined,
    AccountDetails: {
      Rent: localLease.rent_amount,
      SecurityDeposit: localLease.security_deposit || undefined
    }
  }
}

export function mapLeaseFromBuildium(buildiumLease: BuildiumLease): any {
  return {
    buildium_lease_id: buildiumLease.Id,
    buildium_property_id: buildiumLease.PropertyId,
    buildium_unit_id: buildiumLease.UnitId,
    unit_number: buildiumLease.UnitNumber,
    lease_from_date: buildiumLease.LeaseFromDate,
    lease_to_date: buildiumLease.LeaseToDate,
    lease_type: buildiumLease.LeaseType,
    status: buildiumLease.LeaseStatus,
    is_eviction_pending: buildiumLease.IsEvictionPending,
    term_type: buildiumLease.TermType,
    renewal_offer_status: buildiumLease.RenewalOfferStatus,
    current_number_of_occupants: buildiumLease.CurrentNumberOfOccupants,
    security_deposit: buildiumLease.AccountDetails.SecurityDeposit,
    rent_amount: buildiumLease.AccountDetails.Rent,
    automatically_move_out_tenants: buildiumLease.AutomaticallyMoveOutTenants,
    buildium_created_at: buildiumLease.CreatedDateTime,
    buildium_updated_at: buildiumLease.LastUpdatedDateTime,
    payment_due_day: buildiumLease.PaymentDueDay
  }
}

function mapLeaseStatusToBuildium(localStatus: string): 'Future' | 'Active' | 'Past' | 'Cancelled' {
  switch (localStatus?.toLowerCase()) {
    case 'future':
      return 'Future'
    case 'past':
      return 'Past'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Active'
  }
}

function mapLeaseStatusFromBuildium(buildiumStatus: 'Future' | 'Active' | 'Past' | 'Cancelled'): string {
  switch (buildiumStatus) {
    case 'Future':
      return 'future'
    case 'Past':
      return 'past'
    case 'Cancelled':
      return 'cancelled'
    default:
      return 'active'
  }
}

// ============================================================================
// SYNC STATUS MAPPERS
// ============================================================================

export function mapSyncStatusToBuildium(localSyncStatus: any): BuildiumSyncStatus {
  return {
    entityType: localSyncStatus.entity_type,
    entityId: localSyncStatus.entity_id,
    buildiumId: localSyncStatus.buildium_id || undefined,
    lastSyncedAt: localSyncStatus.last_synced_at || undefined,
    syncStatus: localSyncStatus.sync_status,
    errorMessage: localSyncStatus.error_message || undefined,
    createdAt: localSyncStatus.created_at,
    updatedAt: localSyncStatus.updated_at
  }
}

export function mapSyncStatusFromBuildium(buildiumSyncStatus: BuildiumSyncStatus): any {
  return {
    entity_type: buildiumSyncStatus.entityType,
    entity_id: buildiumSyncStatus.entityId,
    buildium_id: buildiumSyncStatus.buildiumId,
    last_synced_at: buildiumSyncStatus.lastSyncedAt,
    sync_status: buildiumSyncStatus.syncStatus,
    error_message: buildiumSyncStatus.errorMessage,
    created_at: buildiumSyncStatus.createdAt,
    updated_at: buildiumSyncStatus.updatedAt
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function sanitizeForBuildium(data: any): any {
  // Remove undefined values and null values that Buildium doesn't accept
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key]
    }
  })
  
  return sanitized
}

export function validateBuildiumResponse(response: any): boolean {
  // Basic validation for Buildium API responses
  return response && typeof response === 'object' && !response.error
}

export function extractBuildiumId(response: any): number | null {
  // Extract Buildium ID from various response formats
  if (response?.Id) return response.Id
  if (response?.id) return response.id
  if (response?.data?.Id) return response.data.Id
  return null
}

// ============================================================================
// TENANT MAPPING FUNCTIONS
// ============================================================================

/**
 * Maps a Buildium tenant to database contact format
 * Handles phone numbers, country mapping, and data type conversions
 */
export function mapTenantToContact(buildiumTenant: any): any {
  // Handle phone numbers
  const mobilePhone = buildiumTenant.PhoneNumbers?.find((p: any) => p.Type === 'Cell')?.Number || ''
  const homePhone = buildiumTenant.PhoneNumbers?.find((p: any) => p.Type === 'Home')?.Number || ''
  const workPhone = buildiumTenant.PhoneNumbers?.find((p: any) => p.Type === 'Work')?.Number || ''

  // Determine primary and alternate phone
  const primaryPhone = mobilePhone || homePhone || ''
  const altPhone = workPhone || homePhone || ''

  // Convert date format
  const dateOfBirth = buildiumTenant.DateOfBirth 
    ? new Date(buildiumTenant.DateOfBirth).toISOString().split('T')[0]
    : null

  return {
    is_company: false,
    first_name: buildiumTenant.FirstName || '',
    last_name: buildiumTenant.LastName || '',
    company_name: null,
    primary_email: buildiumTenant.Email || '',
    alt_email: buildiumTenant.AlternateEmail || '',
    primary_phone: primaryPhone,
    alt_phone: altPhone,
    date_of_birth: dateOfBirth,
    primary_address_line_1: buildiumTenant.Address?.AddressLine1 || '',
    primary_address_line_2: buildiumTenant.Address?.AddressLine2 || '',
    primary_address_line_3: buildiumTenant.Address?.AddressLine3 || '',
    primary_city: buildiumTenant.Address?.City || '',
    primary_state: buildiumTenant.Address?.State || '',
    primary_postal_code: buildiumTenant.Address?.PostalCode || '',
    primary_country: mapCountryFromBuildium(buildiumTenant.Address?.Country),
    alt_address_line_1: buildiumTenant.AlternateAddress?.AddressLine1 || '',
    alt_address_line_2: buildiumTenant.AlternateAddress?.AddressLine2 || '',
    alt_address_line_3: buildiumTenant.AlternateAddress?.AddressLine3 || '',
    alt_city: buildiumTenant.AlternateAddress?.City || '',
    alt_state: buildiumTenant.AlternateAddress?.State || '',
    alt_postal_code: buildiumTenant.AlternateAddress?.PostalCode || '',
    alt_country: mapCountryFromBuildium(buildiumTenant.AlternateAddress?.Country),
    mailing_preference: buildiumTenant.MailingPreference || 'primary'
  }
}

/**
 * Maps a Buildium tenant to database tenant format
 */
export function mapTenantToTenantRecord(buildiumTenant: any): any {
  return {
    buildium_tenant_id: buildiumTenant.Id,
    emergency_contact_name: buildiumTenant.EmergencyContact?.Name || '',
    emergency_contact_relationship: buildiumTenant.EmergencyContact?.RelationshipDescription || '',
    emergency_contact_phone: buildiumTenant.EmergencyContact?.Phone || '',
    emergency_contact_email: buildiumTenant.EmergencyContact?.Email || '',
    sms_opt_in_status: buildiumTenant.SMSOptInStatus || false,
    comment: buildiumTenant.Comment || '',
    tax_id: buildiumTenant.TaxId || ''
  }
}

/**
 * Finds an existing contact by email or creates a new one
 * Updates missing fields if contact exists
 */
export async function findOrCreateContact(buildiumTenant: any, supabase: any): Promise<number> {
  try {
    // Try to find existing contact by email
    const { data: existingContact, error: findError } = await supabase
      .from('contacts')
      .select('*')
      .eq('primary_email', buildiumTenant.Email)
      .single()

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error finding contact:', findError)
      throw findError
    }

    if (existingContact) {
      // Update missing fields only
      const contactData = mapTenantToContact(buildiumTenant)
      const updateData: any = {}
      
      // Only update fields that are empty in the existing record
      Object.entries(contactData).forEach(([key, value]) => {
        if (value && !existingContact[key]) {
          updateData[key] = value
        }
      })

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', existingContact.id)

        if (updateError) {
          console.error('Error updating contact:', updateError)
          throw updateError
        }
        console.log(`✅ Updated existing contact: ${existingContact.id}`)
      }

      return existingContact.id
    } else {
      // Create new contact
      const contactData = mapTenantToContact(buildiumTenant)
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating contact:', createError)
        throw createError
      }

      console.log(`✅ Created new contact: ${newContact.id}`)
      return newContact.id
    }
  } catch (error) {
    console.error('❌ Failed to find or create contact:', error)
    throw error
  }
}

/**
 * Finds an existing tenant by buildium_tenant_id or creates a new one
 */
export async function findOrCreateTenant(contactId: number, buildiumTenant: any, supabase: any): Promise<string> {
  try {
    // Try to find existing tenant by buildium_tenant_id
    const { data: existingTenant, error: findError } = await supabase
      .from('tenants')
      .select('*')
      .eq('buildium_tenant_id', buildiumTenant.Id)
      .single()

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error finding tenant:', findError)
      throw findError
    }

    if (existingTenant) {
      // Update missing fields only
      const tenantData = mapTenantToTenantRecord(buildiumTenant)
      const updateData: any = {}
      
      // Only update fields that are empty in the existing record
      Object.entries(tenantData).forEach(([key, value]) => {
        if (value && !existingTenant[key]) {
          updateData[key] = value
        }
      })

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('tenants')
          .update(updateData)
          .eq('id', existingTenant.id)

        if (updateError) {
          console.error('Error updating tenant:', updateError)
          throw updateError
        }
        console.log(`✅ Updated existing tenant: ${existingTenant.id}`)
      }

      return existingTenant.id
    } else {
      // Create new tenant
      const tenantData = {
        ...mapTenantToTenantRecord(buildiumTenant),
        contact_id: contactId,
        updated_at: new Date().toISOString()
      }

      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert(tenantData)
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating tenant:', createError)
        throw createError
      }

      console.log(`✅ Created new tenant: ${newTenant.id}`)
      return newTenant.id
    }
  } catch (error) {
    console.error('❌ Failed to find or create tenant:', error)
    throw error
  }
}

/**
 * Creates lease_contacts relationship between lease and tenant
 */
export async function createLeaseContactRelationship(
  leaseId: number, 
  tenantId: string, 
  role: string, 
  supabase: any
): Promise<string> {
  try {
    const leaseContactData = {
      lease_id: leaseId,
      tenant_id: tenantId,
      role: role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: leaseContact, error } = await supabase
      .from('lease_contacts')
      .insert(leaseContactData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating lease contact relationship:', error)
      throw error
    }

    console.log(`✅ Created lease contact relationship: ${leaseContact.id}`)
    return leaseContact.id
  } catch (error) {
    console.error('❌ Failed to create lease contact relationship:', error)
    throw error
  }
}

/**
 * Enhanced lease mapper that handles tenant relationships
 * Processes Tenants array and Cosigners array from Buildium lease
 */
export async function mapLeaseFromBuildiumWithTenants(
  buildiumLease: any,
  supabase: any
): Promise<any> {
  const baseLease = mapLeaseFromBuildium(buildiumLease)
  const tenantRelationships: Array<{ tenantId: string; role: string }> = []

  try {
    // Process Tenants array
    if (buildiumLease.Tenants && Array.isArray(buildiumLease.Tenants)) {
      for (const tenant of buildiumLease.Tenants) {
        try {
          const contactId = await findOrCreateContact(tenant, supabase)
          const tenantId = await findOrCreateTenant(contactId, tenant, supabase)
          tenantRelationships.push({ tenantId, role: 'Tenant' })
        } catch (error) {
          console.warn(`⚠️ Skipping tenant ${tenant.Id}:`, error)
          // Continue with other tenants
        }
      }
    }

    // Process Cosigners array (Guarantors)
    if (buildiumLease.Cosigners && Array.isArray(buildiumLease.Cosigners)) {
      for (const cosigner of buildiumLease.Cosigners) {
        try {
          const contactId = await findOrCreateContact(cosigner, supabase)
          const tenantId = await findOrCreateTenant(contactId, cosigner, supabase)
          tenantRelationships.push({ tenantId, role: 'Guarantor' })
        } catch (error) {
          console.warn(`⚠️ Skipping cosigner ${cosigner.Id}:`, error)
          // Continue with other cosigners
        }
      }
    }

    return {
      ...baseLease,
      tenantRelationships
    }
  } catch (error) {
    console.error('❌ Error in enhanced lease mapping:', error)
    // Return base lease even if tenant processing fails
    return baseLease
  }
}
