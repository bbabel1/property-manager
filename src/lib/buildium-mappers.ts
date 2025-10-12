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
  BuildiumBankAccountCreate,
  BuildiumLease,
  BuildiumLeaseCreate,
  BuildiumLeaseType,
  BuildiumLeaseTermType,
  BuildiumLeaseRenewalStatus,
  BuildiumSyncStatus
} from '../types/buildium'
import type {
  BuildiumWorkOrder,
  BuildiumWorkOrderCreate,
  BuildiumWorkOrderUpdate,
  BuildiumWorkOrderPriority,
  BuildiumWorkOrderStatus
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
// TRANSACTION HELPERS AND MAPPERS
// ============================================================================

/**
 * Normalizes a date string from Buildium to YYYY-MM-DD
 */
function normalizeDateString(input: string | null | undefined): string {
  if (!input) return new Date().toISOString().slice(0, 10)
  // Buildium typically returns ISO date strings; keep only the date part
  return input.slice(0, 10)
}

/**
 * Maps external payment method strings to our normalized payment_method_enum values.
 * Unknown or unmapped values return null (per requirement).
 */
export function mapPaymentMethodToEnum(method: string | null | undefined):
  | 'Check'
  | 'Cash'
  | 'MoneyOrder'
  | 'CashierCheck'
  | 'DirectDeposit'
  | 'CreditCard'
  | 'ElectronicPayment'
  | null {
  if (!method) return null
  const m = String(method).trim().toLowerCase().replace(/\s+/g, ' ')

  // Handle common Buildium variants and friendly names
  if (m === 'check' || m === 'check payment') return 'Check'
  if (m === 'cash') return 'Cash'
  if (m === 'money order' || m === 'money_order') return 'MoneyOrder'
  if (m === 'cashier check' || m === 'cashier_check' || m === 'cashiers check') return 'CashierCheck'
  if (m === 'direct deposit' || m === 'banktransfer' || m === 'bank transfer' || m === 'ach') return 'DirectDeposit'
  if (m === 'credit card' || m === 'creditcard') return 'CreditCard'
  if (m === 'electronic payment' || m === 'onlinepayment' || m === 'online payment' || m === 'epayment') return 'ElectronicPayment'
  return null
}

// ============================================================================
// GENERAL LEDGER ENTRY HELPERS
// ============================================================================

function mapTransactionTypeFromAny(input: string | null | undefined): 'Bill' | 'Charge' | 'Credit' | 'Payment' {
  const v = (input || '').toString().toLowerCase()
  if (v.includes('payment')) return 'Payment'
  if (v.includes('credit')) return 'Credit'
  if (v.includes('bill')) return 'Bill'
  // Default to Charge for journal/general entries
  return 'Charge'
}

/**
 * Maps a Buildium GL Entry header to our transactions table shape
 */
export function mapGLEntryHeaderFromBuildium(buildiumEntry: any): any {
  const nowIso = new Date().toISOString()
  const totalAmount = typeof buildiumEntry?.TotalAmount === 'number'
    ? buildiumEntry.TotalAmount
    : Array.isArray(buildiumEntry?.Lines)
      ? buildiumEntry.Lines.reduce((sum: number, l: any) => sum + Math.abs(Number(l?.Amount || 0)), 0)
      : 0
  return {
    buildium_transaction_id: buildiumEntry?.Id ?? null,
    date: normalizeDateString(buildiumEntry?.Date),
    total_amount: Number(totalAmount),
    check_number: buildiumEntry?.CheckNumber ?? null,
    memo: buildiumEntry?.Memo ?? null,
    transaction_type: 'JournalEntry',
    updated_at: nowIso
  }
}

/**
 * Upserts a GL Entry (general journal) and its lines into transactions + transaction_lines
 */
export async function upsertGLEntryWithLines(buildiumEntry: any, supabase: any): Promise<{ transactionId: string }>{
  const nowIso = new Date().toISOString()
  const header = mapGLEntryHeaderFromBuildium(buildiumEntry)

  // Look up existing transaction by buildium_transaction_id
  let existing: any = null
  {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('buildium_transaction_id', header.buildium_transaction_id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    existing = data ?? null
  }

  let transactionId: string
  if (existing) {
    const { data, error } = await supabase
      .from('transactions')
      .update(header)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...header, created_at: nowIso })
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  // Replace lines
  {
    const { error } = await supabase
      .from('transaction_lines')
      .delete()
      .eq('transaction_id', transactionId)
    if (error) throw error
  }

  const pendingLines: any[] = []
  let debitSum = 0
  let creditSum = 0
  for (const line of (buildiumEntry?.Lines || [])) {
    const amountNum = Number(line?.Amount ?? 0)
    const postingType = (line?.PostingType === 'Debit' || line?.PostingType === 'Credit') ? line.PostingType : (amountNum >= 0 ? 'Credit' : 'Debit')

    // Resolve GL account (hard fail if not resolvable)
    const glAccountId = await resolveGLAccountId(line?.GLAccountId ?? line?.GLAccount?.Id, supabase)
    if (!glAccountId) throw new Error(`Failed to resolve GL account for GL entry line. Buildium GLAccountId: ${line?.GLAccountId}`)

    // Enforce AccountingEntity presence
    if (!line?.AccountingEntity || !line?.AccountingEntity?.AccountingEntityType) {
      throw new Error('AccountingEntity with AccountingEntityType is required for GL entry lines')
    }

    const buildiumPropertyId = line?.AccountingEntity?.Id ?? null
    const buildiumUnitId = line?.AccountingEntity?.Unit?.Id
      ?? line?.AccountingEntity?.UnitId
      ?? null
    const localPropertyId = await resolveLocalPropertyId(buildiumPropertyId, supabase)
    const localUnitId = await resolveLocalUnitId(buildiumUnitId, supabase)

    const entityTypeRaw = (line?.AccountingEntity?.AccountingEntityType || 'Rental') as string
    const entityType: 'Rental' | 'Company' = String(entityTypeRaw).toLowerCase() === 'rental' ? 'Rental' : 'Company'

    pendingLines.push({
      transaction_id: transactionId,
      gl_account_id: glAccountId,
      amount: Math.abs(amountNum),
      posting_type: postingType,
      memo: line?.Memo ?? null,
      account_entity_type: entityType,
      account_entity_id: buildiumPropertyId ?? null,
      date: normalizeDateString(buildiumEntry?.Date),
      created_at: nowIso,
      updated_at: nowIso,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: null,
      property_id: localPropertyId,
      unit_id: localUnitId
    })

    if (postingType === 'Debit') debitSum += Math.abs(amountNum)
    else creditSum += Math.abs(amountNum)
  }

  if (pendingLines.length > 0) {
    const { error } = await supabase
      .from('transaction_lines')
      .insert(pendingLines)
    if (error) throw error
  }

  // Double-entry integrity: debits must equal credits
  const diff = Math.abs(debitSum - creditSum)
  if (diff > 0.0001) {
    throw new Error(`Double-entry integrity violation: debits (${debitSum}) != credits (${creditSum})`)
  }

  // Upsert into journal_entries table
  try {
    const je = {
      buildium_gl_entry_id: buildiumEntry?.Id ?? null,
      transaction_id: transactionId,
      date: normalizeDateString(buildiumEntry?.Date),
      memo: buildiumEntry?.Memo ?? null,
      check_number: buildiumEntry?.CheckNumber ?? null,
      total_amount: pendingLines.reduce((s, l) => s + Number(l.amount || 0), 0),
      updated_at: new Date().toISOString()
    }
    // Check existing
    const { data: existingJE, error: findErr } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('buildium_gl_entry_id', je.buildium_gl_entry_id)
      .single()
    if (findErr && findErr.code !== 'PGRST116') throw findErr
    if (existingJE) {
      const { error } = await supabase
        .from('journal_entries')
        .update(je)
        .eq('id', existingJE.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('journal_entries')
        .insert({ ...je, created_at: new Date().toISOString() })
      if (error) throw error
    }
  } catch (err) {
    // Surface errors since this is part of required ingestion
    throw err
  }

  return { transactionId }
}

// ============================================================================
// TRANSACTION (BILL) -> BUILDIUM MAPPER
// ============================================================================

/**
 * Map a local transactions row (type Bill) + its transaction_lines
 * into a Buildium Bill Create/Update payload.
 */
export async function mapTransactionBillToBuildium(
  transactionId: string,
  supabase: any
): Promise<BuildiumBillCreate> {
  // Fetch transaction and lines
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single()
  if (txErr || !tx) {
    throw new Error(`Transaction not found: ${transactionId}`)
  }
  if (tx.transaction_type !== 'Bill') {
    throw new Error('Transaction is not a Bill')
  }

  // Resolve VendorId from vendors table (auto-create in Buildium if missing)
  let vendorBuildiumId: number | null = null
  if (tx.vendor_id) {
    const { data: vendorRow, error: vendErr } = await supabase
      .from('vendors')
      .select('id, buildium_vendor_id, contact_id, vendor_category, buildium_category_id, is_active')
      .eq('id', tx.vendor_id)
      .single()
    if (vendErr) throw vendErr
    vendorBuildiumId = vendorRow?.buildium_vendor_id ?? null

    if (!vendorBuildiumId && vendorRow) {
      // Load contact for name/address/email/phone
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', vendorRow.contact_id)
        .single()
      if (contactErr) throw contactErr

      // Resolve Buildium CategoryId if present
      let buildiumCategoryId: number | undefined
      if (vendorRow.vendor_category) {
        const { data: cat, error: catErr } = await supabase
          .from('vendor_categories')
          .select('buildium_category_id')
          .eq('id', vendorRow.vendor_category)
          .single()
        if (!catErr && typeof cat?.buildium_category_id === 'number') buildiumCategoryId = cat.buildium_category_id
      }

      // Build a minimal Buildium vendor payload from contact/vendor
      const vendorPayload: any = {
        Name: contact?.company_name
          ? contact.company_name
          : [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || contact?.display_name || 'Vendor',
        CategoryId: buildiumCategoryId,
        Email: contact?.primary_email || undefined,
        PhoneNumber: contact?.primary_phone || undefined,
        Address: {
          AddressLine1: contact?.primary_address_line_1 || '',
          AddressLine2: contact?.primary_address_line_2 || undefined,
          City: contact?.primary_city || '',
          State: contact?.primary_state || '',
          PostalCode: contact?.primary_postal_code || '',
          Country: (contact?.primary_country as string) || 'United States'
        },
        IsActive: vendorRow?.is_active !== false
      }

      // Create vendor in Buildium
      const resp = await fetch(`${process.env.BUILDIUM_BASE_URL}/vendors`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
          'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
        },
        body: JSON.stringify(vendorPayload)
      })
      if (resp.ok) {
        const created = await resp.json()
        vendorBuildiumId = created?.Id || null
        if (vendorBuildiumId) {
          await supabase
            .from('vendors')
            .update({ buildium_vendor_id: vendorBuildiumId, updated_at: new Date().toISOString() })
            .eq('id', vendorRow.id)
        }
      } else {
        const details = await resp.json().catch(() => ({}))
        throw new Error(`Failed to auto-create vendor in Buildium: ${resp.status} ${resp.statusText} ${JSON.stringify(details)}`)
      }
    }
  }
  if (!vendorBuildiumId) {
    throw new Error('Vendor missing buildium_vendor_id; unable to push bill to Buildium')
  }

  // Resolve CategoryId from bill_categories
  let billCategoryBuildiumId: number | undefined
  if (tx.category_id) {
    const { data: cat, error: catErr } = await supabase
      .from('bill_categories')
      .select('buildium_category_id')
      .eq('id', tx.category_id)
      .single()
    if (catErr) throw catErr
    if (typeof cat?.buildium_category_id === 'number') billCategoryBuildiumId = cat.buildium_category_id
  }

  // Load lines
  const { data: lines, error: linesErr } = await supabase
    .from('transaction_lines')
    .select('*')
    .eq('transaction_id', transactionId)
  if (linesErr) throw linesErr

  // Build Buildium Lines from local lines
  const buildiumLines: NonNullable<BuildiumBillCreate['Lines']> = []
  for (const line of lines || []) {
    if (!line.gl_account_id) {
      throw new Error('Line missing gl_account_id')
    }
    // Resolve Buildium GL Account ID (auto-resolve by name/number if missing)
    let glId: number | null = null
    {
      const { data: gl, error: glErr } = await supabase
        .from('gl_accounts')
        .select('id, name, account_number, buildium_gl_account_id')
        .eq('id', line.gl_account_id)
        .single()
      if (glErr) throw glErr
      glId = gl?.buildium_gl_account_id ?? null

      if (!glId) {
        // Try to find matching GL account in Buildium by AccountNumber or Name
        const resp = await fetch(`${process.env.BUILDIUM_BASE_URL}/generalLedger/accounts`, {
          headers: {
            'Accept': 'application/json',
            'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
            'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
          }
        })
        if (resp.ok) {
          const list = await resp.json()
          const match = (Array.isArray(list) ? list : []).find((acc: any) => {
            const numMatch = gl?.account_number && String(acc?.AccountNumber || '').trim() === String(gl.account_number).trim()
            const nameMatch = gl?.name && String(acc?.Name || '').trim().toLowerCase() === String(gl.name).trim().toLowerCase()
            return numMatch || nameMatch
          })
          if (match?.Id) {
            glId = match.Id
            await supabase
              .from('gl_accounts')
              .update({ buildium_gl_account_id: glId, updated_at: new Date().toISOString() })
              .eq('id', gl.id)
          }
        }
      }
    }
    if (!glId) {
      throw new Error('Line GL account missing buildium_gl_account_id and no match found in Buildium')
    }

    // Resolve Buildium property/unit IDs
    let accountingEntityId: number | undefined
    let unitId: number | undefined

    if (line.buildium_property_id) {
      accountingEntityId = line.buildium_property_id
    } else if (line.property_id) {
      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .select('buildium_property_id')
        .eq('id', line.property_id)
        .single()
      if (!propErr && typeof prop?.buildium_property_id === 'number') accountingEntityId = prop.buildium_property_id
    }

    if (line.buildium_unit_id) {
      unitId = line.buildium_unit_id
    } else if (line.unit_id) {
      const { data: unit, error: unitErr } = await supabase
        .from('units')
        .select('buildium_unit_id')
        .eq('id', line.unit_id)
        .single()
      if (!unitErr && typeof unit?.buildium_unit_id === 'number') unitId = unit.buildium_unit_id
    }

    buildiumLines.push({
      AccountingEntity: accountingEntityId
        ? { Id: accountingEntityId, AccountingEntityType: 'Rental', UnitId: unitId }
        : { Id: 0, AccountingEntityType: 'Rental', UnitId: unitId },
      GlAccountId: glId,
      Amount: Number(line.amount ?? 0) * (line.posting_type === 'Credit' ? -1 : 1),
      Memo: line.memo ?? undefined
    })
  }

  const payload: BuildiumBillCreate = {
    VendorId: vendorBuildiumId,
    Date: normalizeDateString(tx.date),
    DueDate: tx.due_date ? normalizeDateString(tx.due_date) : undefined,
    Amount: Number(tx.total_amount ?? 0),
    Description: tx.memo || '',
    ReferenceNumber: tx.reference_number || undefined,
    CategoryId: billCategoryBuildiumId,
    Lines: buildiumLines.length > 0 ? buildiumLines : undefined
  }

  return payload
}

/**
 * Finds local lease ID by Buildium lease ID
 */
async function resolveLocalLeaseId(buildiumLeaseId: number | null | undefined, supabase: any): Promise<number | null> {
  if (!buildiumLeaseId) return null
  const { data, error } = await supabase
    .from('lease')
    .select('id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return data?.id ?? null
}

/**
 * Finds local property ID (UUID) by Buildium property ID
 */
async function resolveLocalPropertyId(buildiumPropertyId: number | null | undefined, supabase: any): Promise<string | null> {
  if (!buildiumPropertyId) return null
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return data?.id ?? null
}

/**
 * Finds local unit ID (UUID) by Buildium unit ID
 */
async function resolveLocalUnitId(buildiumUnitId: number | null | undefined, supabase: any): Promise<string | null> {
  if (!buildiumUnitId) return null
  const { data, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single()
  if (error && error.code !== 'PGRST116') {
    throw error
  }
  return data?.id ?? null
}

/**
 * Maps a Buildium lease transaction object to our transactions insert/update payload.
 * Does not write to DB; used by upsert orchestrator below.
 */
export function mapLeaseTransactionFromBuildium(buildiumTx: any): any {
  return {
    buildium_transaction_id: buildiumTx.Id,
    date: normalizeDateString(buildiumTx.Date || buildiumTx.TransactionDate || buildiumTx.PostDate),
    transaction_type: buildiumTx.TransactionTypeEnum || buildiumTx.TransactionType,
    total_amount: typeof buildiumTx.TotalAmount === 'number' ? buildiumTx.TotalAmount : (typeof buildiumTx.Amount === 'number' ? buildiumTx.Amount : 0),
    check_number: buildiumTx.CheckNumber ?? null,
    buildium_lease_id: buildiumTx.LeaseId ?? null,
    payee_tenant_id: buildiumTx.PayeeTenantId ?? null,
    payment_method: mapPaymentMethodToEnum(buildiumTx.PaymentMethod),
    memo: buildiumTx?.Journal?.Memo ?? buildiumTx?.Memo ?? null
  }
}

/**
 * Upserts a transaction by buildium_transaction_id, then deletes and re-inserts all transaction lines.
 * Enforces that at least one local FK is present (lease_id or any line with property_id/unit_id).
 * Fails the whole import if any GL account cannot be resolved.
 */
export async function upsertLeaseTransactionWithLines(buildiumTx: any, supabase: any): Promise<{ transactionId: string }> {
  const nowIso = new Date().toISOString()
  const mappedTx = mapLeaseTransactionFromBuildium(buildiumTx)

  // Resolve local lease_id
  const localLeaseId = await resolveLocalLeaseId(buildiumTx.LeaseId, supabase)

  // Find existing transaction by buildium_transaction_id
  let existingTx: any = null
  {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('buildium_transaction_id', mappedTx.buildium_transaction_id)
      .single()
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    existingTx = data ?? null
  }

  let transactionId: string
  if (existingTx) {
    const updatePayload = {
      ...mappedTx,
      lease_id: localLeaseId,
      updated_at: nowIso
    }
    const { data, error } = await supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', existingTx.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const insertPayload = {
      ...mappedTx,
      lease_id: localLeaseId,
      created_at: nowIso,
      updated_at: nowIso
    }
    const { data, error } = await supabase
      .from('transactions')
      .insert(insertPayload)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  const lines: any[] = (Array.isArray(buildiumTx?.Lines) ? buildiumTx.Lines : []) || buildiumTx?.Journal?.Lines || []
  const pendingLineRows: any[] = []
  let debitSum = 0
  let creditSum = 0

  for (const line of lines) {
    const amountNum = Number(line?.Amount ?? 0)
    const postingType = amountNum >= 0 ? 'Credit' : 'Debit'

    // Resolve GL account (fail whole import if not resolvable)
    const glAccountBuildiumId = line?.GLAccountId ?? (typeof line?.GLAccount === 'number' ? line.GLAccount : line?.GLAccount?.Id)
    const glAccountId = await resolveGLAccountId(glAccountBuildiumId, supabase)
    if (!glAccountId) {
      throw new Error(`Failed to resolve GL account for line. Buildium GLAccount ID: ${glAccountBuildiumId}`)
    }
    // Lease transaction lines may not include explicit accounting entity; default to Rental
    const buildiumPropertyId = line?.PropertyId ?? null
    const buildiumUnitId = line?.Unit?.Id ?? line?.UnitId ?? null
    const localPropertyId = await resolveLocalPropertyId(buildiumPropertyId, supabase)
    const localUnitId = await resolveLocalUnitId(buildiumUnitId, supabase)

    pendingLineRows.push({
      gl_account_id: glAccountId,
      amount: Math.abs(amountNum),
      posting_type: postingType,
      memo: line?.Memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: buildiumPropertyId ?? null,
      date: normalizeDateString(buildiumTx?.Date),
      created_at: nowIso,
      updated_at: nowIso,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: buildiumTx?.LeaseId ?? null,
      property_id: localPropertyId,
      unit_id: localUnitId
    })

    if (postingType === 'Debit') debitSum += Math.abs(amountNum)
    else creditSum += Math.abs(amountNum)
  }

  // Prefer to have a local FK, but do not hard-fail if missing for lease transactions

  // Delete all existing lines for this transaction (idempotent per requirements)
  {
    const { error } = await supabase
      .from('transaction_lines')
      .delete()
      .eq('transaction_id', transactionId)
    if (error) throw error
  }

  const lineRows = pendingLineRows.map(r => ({ ...r, transaction_id: transactionId }))

  if (lineRows.length > 0) {
    const { error } = await supabase
      .from('transaction_lines')
      .insert(lineRows)
    if (error) throw error
  }

  // Optional double-entry integrity check when both sides present
  if (debitSum > 0 && creditSum > 0) {
    const diff = Math.abs(debitSum - creditSum)
    if (diff > 0.0001) {
      throw new Error(`Double-entry integrity violation on lease transaction ${buildiumTx?.Id}: debits (${debitSum}) != credits (${creditSum})`)
    }
  }

  return { transactionId }
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
    RentalSubType: mapUiPropertyTypeToBuildium(localProperty.property_type || null),
    RentalManager: localProperty.rental_manager || undefined
  }
}

// ============================================================================
// STAFF MAPPERS (Phase 2 helpers)
// ============================================================================

export type BuildiumStaffInput = {
  FirstName?: string
  LastName?: string
  Email?: string
  PhoneNumber?: string
  Title?: string
  Role?: string // Buildium specific role label
}

export function mapStaffToBuildium(local: any): BuildiumStaffInput {
  return {
    FirstName: local.first_name || undefined,
    LastName: local.last_name || undefined,
    Email: local.email || undefined,
    PhoneNumber: local.phone || undefined,
    Title: local.title || undefined,
    Role: ((): string | undefined => {
      const r = String(local.role || '').toUpperCase()
      switch (r) {
        case 'PROPERTY_MANAGER': return 'Property Manager'
        case 'ASSISTANT_PROPERTY_MANAGER': return 'Assistant Manager'
        case 'MAINTENANCE_COORDINATOR': return 'Maintenance Coordinator'
        case 'ACCOUNTANT': return 'Accountant'
        case 'ADMINISTRATOR': return 'Administrator'
        default: return undefined
      }
    })()
  }
}

export function mapStaffFromBuildium(buildium: any): any {
  const role = String(buildium?.Role || '').toLowerCase()
  let localRole: string | null = null
  if (role.includes('assistant')) localRole = 'ASSISTANT_PROPERTY_MANAGER'
  else if (role.includes('maintenance')) localRole = 'MAINTENANCE_COORDINATOR'
  else if (role.includes('accountant')) localRole = 'ACCOUNTANT'
  else if (role.includes('admin')) localRole = 'ADMINISTRATOR'
  else if (role.includes('manager')) localRole = 'PROPERTY_MANAGER'
  return {
    first_name: buildium?.FirstName || null,
    last_name: buildium?.LastName || null,
    email: buildium?.Email || null,
    phone: buildium?.PhoneNumber || null,
    title: buildium?.Title || null,
    role: localRole,
    buildium_staff_id: buildium?.Id ?? null,
  }
}

// Map UI property type to Buildium RentalSubType
// UI options: 'Condo', 'Co-op', 'Condop', 'Rental Building', 'Townhouse'
// Buildium expects: 'CondoTownhome' or 'MultiFamily'
export function mapUiPropertyTypeToBuildium(subType: string | null | undefined): 'CondoTownhome' | 'MultiFamily' | 'SingleFamily' {
  if (!subType) return 'SingleFamily'
  const s = String(subType).toLowerCase()
  if (s === 'rental building' || s === 'mult-family' || s === 'multi-family') return 'MultiFamily'
  if (['condo', 'co-op', 'condop', 'townhouse'].includes(s)) return 'CondoTownhome'
  return 'SingleFamily'
}

// Map Buildium RentalSubType -> UI property type
// Rules provided:
// - CondoTownhome => Condo (default)
// - MultiFamily   => Rental Building
// - Others        => null (leave blank/unmapped)
export function mapBuildiumToUiPropertyType(buildiumSubType: string | null | undefined): string | null {
  if (!buildiumSubType) return null
  const s = String(buildiumSubType).toLowerCase()
  if (s === 'condotownhome') return 'Condo'
  if (s === 'multifamily') return 'Rental Building'
  return null
}

/**
 * @deprecated Use mapPropertyFromBuildiumWithBankAccount() instead to ensure proper bank account relationship handling
 * This basic mapper does NOT handle bank account relationships and will result in missing data
 * @see mapPropertyFromBuildiumWithBankAccount
 */
export function mapPropertyFromBuildium(buildiumProperty: BuildiumProperty): any {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    showDeprecationWarning('mapPropertyFromBuildium', 'mapPropertyFromBuildiumWithBankAccount')
  }
  
  return {
    name: buildiumProperty.Name,
    rental_type: buildiumProperty.RentalType,
    // property_type UX label mapping: MultiFamily => Mult-Family, otherwise null
    property_type: (String(buildiumProperty.RentalSubType || '').toLowerCase() === 'multifamily') ? 'Mult-Family' : null,
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

  const result = {
    ...baseProperty,
    operating_bank_account_id: operatingBankAccountId
  };

  // Validate relationships and log results
  const validation = validatePropertyRelationships(result, buildiumProperty);
  logValidationResults(validation, `Property ${buildiumProperty.Id} (${buildiumProperty.Name})`);

  return result;
}

// ============================================================================
// UNIT MAPPERS
// ============================================================================

export function mapUnitToBuildium(localUnit: any): BuildiumUnitCreate {
  // PropertyId must be a Buildium numeric ID. Prefer explicit buildium_property_id.
  const propertyId = typeof localUnit?.buildium_property_id === 'number' ? localUnit.buildium_property_id : undefined

  return {
    PropertyId: propertyId as number,
    UnitNumber: localUnit.unit_number || localUnit.number || '',
    UnitSize: localUnit.unit_size ?? undefined,
    MarketRent: localUnit.market_rent ?? undefined,
    Address: {
      AddressLine1: localUnit.address_line1 || undefined,
      AddressLine2: localUnit.address_line2 || undefined,
      AddressLine3: localUnit.address_line3 || undefined,
      City: localUnit.city || undefined,
      State: localUnit.state || undefined,
      PostalCode: localUnit.postal_code || undefined,
      Country: mapCountryToBuildium(localUnit.country) || undefined
    },
    UnitBedrooms: mapBedroomsToBuildium(localUnit.unit_bedrooms),
    UnitBathrooms: mapBathroomsToBuildium(localUnit.unit_bathrooms),
    Description: localUnit.description || undefined
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

// Convert local DB enum values to Buildium enums
function mapBedroomsToBuildium(localBedrooms: string | null | undefined):
  | 'NotSet'
  | 'Studio'
  | 'OneBed'
  | 'TwoBed'
  | 'ThreeBed'
  | 'FourBed'
  | 'FiveBed'
  | 'SixBed'
  | 'SevenBed'
  | 'EightBed'
  | 'NineBedPlus'
  | undefined {
  if (!localBedrooms) return undefined
  switch (localBedrooms) {
    case 'Studio': return 'Studio'
    case '1': return 'OneBed'
    case '2': return 'TwoBed'
    case '3': return 'ThreeBed'
    case '4': return 'FourBed'
    case '5+': return 'FiveBed'
    case '6': return 'SixBed'
    case '7': return 'SevenBed'
    case '8': return 'EightBed'
    case '9+': return 'NineBedPlus'
    default: return 'NotSet'
  }
}

function mapBathroomsToBuildium(localBathrooms: string | null | undefined):
  | 'NotSet'
  | 'OneBath'
  | 'OnePointFiveBath'
  | 'TwoBath'
  | 'TwoPointFiveBath'
  | 'ThreeBath'
  | 'ThreePointFiveBath'
  | 'FourBath'
  | 'FourPointFiveBath'
  | 'FiveBath'
  | 'FivePlusBath'
  | undefined {
  if (!localBathrooms) return undefined
  switch (localBathrooms) {
    case '1': return 'OneBath'
    case '1.5': return 'OnePointFiveBath'
    case '2': return 'TwoBath'
    case '2.5': return 'TwoPointFiveBath'
    case '3': return 'ThreeBath'
    case '3.5': return 'ThreePointFiveBath'
    case '4+': return 'FourBath'
    case '4.5': return 'FourPointFiveBath'
    case '5': return 'FiveBath'
    case '5+': return 'FivePlusBath'
    default: return 'NotSet'
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

/**
 * Maps a Buildium owner into our contacts table shape
 */
export function mapOwnerToContact(buildiumOwner: BuildiumOwner): any {
  return {
    is_company: false,
    first_name: buildiumOwner.FirstName || null,
    last_name: buildiumOwner.LastName || null,
    company_name: null,
    primary_email: buildiumOwner.Email || null,
    alt_email: null,
    primary_phone: buildiumOwner.PhoneNumber || null,
    alt_phone: null,
    date_of_birth: null,
    primary_address_line_1: buildiumOwner.Address?.AddressLine1 || null,
    primary_address_line_2: buildiumOwner.Address?.AddressLine2 || null,
    primary_address_line_3: buildiumOwner.Address?.AddressLine3 || null,
    primary_city: buildiumOwner.Address?.City || null,
    primary_state: buildiumOwner.Address?.State || null,
    primary_postal_code: buildiumOwner.Address?.PostalCode || null,
    primary_country: mapCountryFromBuildium(buildiumOwner.Address?.Country) || null,
    alt_address_line_1: null,
    alt_address_line_2: null,
    alt_address_line_3: null,
    alt_city: null,
    alt_state: null,
    alt_postal_code: null,
    alt_country: null,
    mailing_preference: 'primary'
  }
}

/**
 * Find or create a contact record for an owner
 */
export async function findOrCreateOwnerContact(buildiumOwner: BuildiumOwner, supabase: any): Promise<number> {
  const email = buildiumOwner.Email || null
  if (email) {
    const { data: existing, error: findError } = await supabase
      .from('contacts')
      .select('*')
      .eq('primary_email', email)
      .single()
    if (findError && findError.code !== 'PGRST116') throw findError
    if (existing) {
      // Patch missing fields only
      const mapped = mapOwnerToContact(buildiumOwner)
      const update: any = {}
      Object.entries(mapped).forEach(([k, v]) => {
        if (v !== null && v !== '' && !existing[k]) update[k] = v
      })
      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('contacts').update(update).eq('id', existing.id)
        if (error) throw error
      }
      return existing.id
    }
  }

  // Create new contact
  const payload = mapOwnerToContact(buildiumOwner)
  const now = new Date().toISOString()
  const { data: created, error: createError } = await supabase
    .from('contacts')
    .insert({ ...payload, created_at: now, updated_at: now })
    .select('id')
    .single()
  if (createError) throw createError
  return created.id
}

/**
 * Upserts an owner record from a Buildium owner payload.
 * Creates/links a contact and maps owner tax fields.
 */
export async function upsertOwnerFromBuildium(buildiumOwner: BuildiumOwner, supabase: any): Promise<{ ownerId: string; created?: boolean }>{
  const contactId = await findOrCreateOwnerContact(buildiumOwner, supabase)
  const now = new Date().toISOString()

  const tax = buildiumOwner.TaxInformation || {}
  const taxAddr = tax.Address || {}
  const base = {
    contact_id: contactId,
    is_active: buildiumOwner.IsActive ?? true,
    management_agreement_start_date: buildiumOwner.ManagementAgreementStartDate || null,
    management_agreement_end_date: buildiumOwner.ManagementAgreementEndDate || null,
    tax_address_line1: taxAddr.AddressLine1 || null,
    tax_address_line2: taxAddr.AddressLine2 || null,
    tax_address_line3: taxAddr.AddressLine3 || null,
    tax_city: taxAddr.City || null,
    tax_state: taxAddr.State || null,
    tax_postal_code: taxAddr.PostalCode || null,
    tax_country: mapCountryFromBuildium(taxAddr.Country),
    tax_payer_id: tax.TaxPayerId || buildiumOwner.TaxId || null,
    tax_payer_name1: tax.TaxPayerName1 || null,
    tax_payer_name2: tax.TaxPayerName2 || null,
    tax_include1099: tax.IncludeIn1099 ?? null,
    buildium_owner_id: buildiumOwner.Id,
    buildium_created_at: (buildiumOwner as any).CreatedDate || null,
    buildium_updated_at: (buildiumOwner as any).ModifiedDate || null,
    updated_at: now
  }

  // Check existing by buildium_owner_id
  const { data: existing, error: findError } = await supabase
    .from('owners')
    .select('id')
    .eq('buildium_owner_id', buildiumOwner.Id)
    .single()
  if (findError && findError.code !== 'PGRST116') throw findError

  if (existing) {
    const { error } = await supabase
      .from('owners')
      .update(base)
      .eq('id', existing.id)
    if (error) throw error
    return { ownerId: existing.id, created: false }
  } else {
    const insertPayload = { ...base, created_at: now }
    const { data: created, error } = await supabase
      .from('owners')
      .insert(insertPayload)
      .select('id')
      .single()
    if (error) throw error
    return { ownerId: created.id, created: true }
  }
}

// ============================================================================
// VENDOR MAPPERS
// ============================================================================

export function mapVendorToBuildium(localVendor: any): BuildiumVendorCreate {
  return {
    Name: localVendor.name,
    CategoryId: localVendor.buildium_category_id,
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
  const v: any = buildiumVendor as any

  // Handle phones: support both array-of-objects and flat object variants
  const phoneArray: Array<{ Number?: string; Type?: string }> = Array.isArray(v.PhoneNumbers) ? v.PhoneNumbers : []
  const phoneObj: any = !Array.isArray(v.PhoneNumbers) && typeof v.PhoneNumbers === 'object' ? v.PhoneNumbers : {}
  const mobileFromArray = phoneArray.find((p) => String(p?.Type || '').toLowerCase() === 'mobile' || String(p?.Type || '').toLowerCase() === 'cell')?.Number
  const workFromArray = phoneArray.find((p) => String(p?.Type || '').toLowerCase() === 'work')?.Number
  const primaryPhone = mobileFromArray || phoneObj?.Mobile || phoneObj?.Cell || v.PhoneNumber || null
  const altPhone = workFromArray || phoneObj?.Work || null

  // Normalize dates (insurance expiration)
  const insuranceExpirationDate: string | null = v?.VendorInsurance?.ExpirationDate
    ? new Date(v.VendorInsurance.ExpirationDate).toISOString().slice(0, 10)
    : null

  // Tax address object (optional)
  const taxAddr = v?.TaxInformation?.Address || {}

  const base: any = {
    // Core identifiers and status
    buildium_vendor_id: v.Id,
    is_active: v.IsActive ?? true,

    // Website and comments
    website: v.Website ?? null,
    comments: v.Comments ?? null,

    // Insurance
    insurance_provider: v?.VendorInsurance?.Provider ?? null,
    insurance_policy_number: v?.VendorInsurance?.PolicyNumber ?? null,
    insurance_expiration_date: insuranceExpirationDate,

    // Accounting
    account_number: v?.AccountNumber ?? null,
    expense_gl_account_id: v?.ExpenseGLAccountId ?? null,

    // Tax information
    tax_payer_type: v?.TaxInformation?.TaxPayerIdType ?? null,
    tax_id: v?.TaxInformation?.TaxPayerId ?? v?.TaxId ?? null,
    tax_payer_name1: v?.TaxInformation?.TaxPayerName1 ?? null,
    tax_payer_name2: v?.TaxInformation?.TaxPayerName2 ?? null,
    include_1099: v?.TaxInformation?.IncludeIn1099 ?? null,
    tax_address_line1: taxAddr?.AddressLine1 ?? null,
    tax_address_line2: taxAddr?.AddressLine2 ?? null,
    tax_address_line3: taxAddr?.AddressLine3 ?? null,
    tax_address_city: taxAddr?.City ?? null,
    tax_address_state: taxAddr?.State ?? null,
    tax_address_postal_code: taxAddr?.PostalCode ?? null,
    tax_address_country: mapCountryFromBuildium(taxAddr?.Country),

    // Category (Buildium source id)
    buildium_category_id: v?.Category?.Id ?? v?.CategoryId ?? null,

    // Notes mapping from legacy field name
    notes: v?.Notes ?? null,

    // Buildium metadata
    buildium_created_at: v?.CreatedDate ?? null,
    buildium_updated_at: v?.ModifiedDate ?? null
  }

  return base
}

/**
 * Resolves or creates a vendor category from Buildium vendor payload.
 * Looks up by vendor_categories.buildium_category_id, creates on miss.
 * Returns the UUID for vendors.vendor_category.
 */
export async function resolveVendorCategoryIdFromBuildium(
  buildiumVendor: BuildiumVendor,
  supabase: any
): Promise<string | null> {
  const v: any = buildiumVendor as any
  const buildiumCategoryId: number | null = v?.Category?.Id ?? v?.CategoryId ?? null
  const buildiumCategoryName: string | null = v?.Category?.Name ?? null
  if (!buildiumCategoryId) return null

  try {
    // Find by Buildium category id
    const { data: existing, error: findErr } = await supabase
      .from('vendor_categories')
      .select('id')
      .eq('buildium_category_id', buildiumCategoryId)
      .single()

    if (!findErr && existing) return existing.id
    if (findErr && findErr.code !== 'PGRST116') throw findErr

    // Create if not found
    const now = new Date().toISOString()
    const insertPayload: any = {
      buildium_category_id: buildiumCategoryId,
      name: buildiumCategoryName || `Category ${buildiumCategoryId}`,
      created_at: now,
      updated_at: now
    }
    const { data: created, error: createErr } = await supabase
      .from('vendor_categories')
      .insert(insertPayload)
      .select('id')
      .single()
    if (createErr) throw createErr
    return created.id
  } catch (err) {
    console.warn('Failed to resolve/create vendor category:', err)
    return null
  }
}

/**
 * Enhanced mapping that also sets vendors.vendor_category via lookup/create.
 */
export async function mapVendorFromBuildiumWithCategory(
  buildiumVendor: BuildiumVendor,
  supabase: any
): Promise<any> {
  const base = mapVendorFromBuildium(buildiumVendor)
  try {
    const [categoryId, contactId] = await Promise.all([
      resolveVendorCategoryIdFromBuildium(buildiumVendor, supabase),
      findOrCreateVendorContact(buildiumVendor, supabase)
    ])
    return { ...base, vendor_category: categoryId, contact_id: contactId }
  } catch {
    return base
  }
}

/**
 * Maps a Buildium vendor into our contacts table shape.
 * Primary phone prefers Mobile/Cell, alt phone prefers Work.
 */
export function mapVendorToContact(buildiumVendor: BuildiumVendor): any {
  const v: any = buildiumVendor as any
  const phoneArray: Array<{ Number?: string; Type?: string }> = Array.isArray(v.PhoneNumbers) ? v.PhoneNumbers : []
  const phoneObj: any = !Array.isArray(v.PhoneNumbers) && typeof v.PhoneNumbers === 'object' ? v.PhoneNumbers : {}
  const mobileFromArray = phoneArray.find((p) => String(p?.Type || '').toLowerCase() === 'mobile' || String(p?.Type || '').toLowerCase() === 'cell')?.Number
  const workFromArray = phoneArray.find((p) => String(p?.Type || '').toLowerCase() === 'work')?.Number

  return {
    is_company: v.IsCompany ?? true,
    first_name: v.FirstName || null,
    last_name: v.LastName || null,
    company_name: v.CompanyName || null,
    primary_email: v.PrimaryEmail || v.Email || null,
    alt_email: v.AlternateEmail || null,
    primary_phone: mobileFromArray || phoneObj?.Mobile || phoneObj?.Cell || v.PhoneNumber || null,
    alt_phone: workFromArray || phoneObj?.Work || null,
    primary_address_line_1: v.Address?.AddressLine1 || null,
    primary_address_line_2: v.Address?.AddressLine2 || null,
    primary_address_line_3: v.Address?.AddressLine3 || null,
    primary_city: v.Address?.City || null,
    primary_state: v.Address?.State || null,
    primary_postal_code: v.Address?.PostalCode || null,
    primary_country: mapCountryFromBuildium(v.Address?.Country) || null,
    mailing_preference: 'primary'
  }
}

/**
 * Find or create a contact row for a vendor using PrimaryEmail if present.
 */
export async function findOrCreateVendorContact(buildiumVendor: BuildiumVendor, supabase: any): Promise<number | null> {
  const email = (buildiumVendor as any).PrimaryEmail || (buildiumVendor as any).Email || null
  try {
    if (email) {
      const { data: existing, error: findErr } = await supabase
        .from('contacts')
        .select('id, primary_email')
        .eq('primary_email', email)
        .single()
      if (!findErr && existing) return existing.id
      if (findErr && findErr.code !== 'PGRST116') throw findErr
    }
    const payload = mapVendorToContact(buildiumVendor)
    const now = new Date().toISOString()
    const { data: created, error: createErr } = await supabase
      .from('contacts')
      .insert({ ...payload, created_at: now, updated_at: now })
      .select('id')
      .single()
    if (createErr) throw createErr
    return created.id
  } catch (err) {
    console.warn('Failed to find/create vendor contact:', err)
    return null
  }
}

// ============================================================================
// TASK MAPPERS
// ============================================================================

/**
 * Detects the newer Buildium Task (v1 OpenAPI) response shape.
 * These responses include fields like Title, TaskStatus, AssignedToUserId,
 * and nested objects for Category and Property.
 */
function isBuildiumTaskV1Shape(task: any): boolean {
  if (!task || typeof task !== 'object') return false
  return (
    'Title' in task ||
    'TaskStatus' in task ||
    'AssignedToUserId' in task ||
    (task.Category && typeof task.Category === 'object') ||
    (task.Property && typeof task.Property === 'object')
  )
}

function v1TaskStatusToLocal(status: string | null | undefined): string {
  switch ((status || '').toLowerCase()) {
    case 'new':
      return 'open'
    case 'inprogress':
    case 'in_progress':
      return 'in_progress'
    case 'completed':
      return 'completed'
    case 'cancelled':
      return 'cancelled'
    case 'onhold':
    case 'on_hold':
      return 'on_hold'
    default:
      return 'open'
  }
}

function localStatusToV1(status: string | null | undefined): 'New' | 'InProgress' | 'Completed' | 'Cancelled' | 'OnHold' {
  switch ((status || '').toLowerCase()) {
    case 'inprogress':
    case 'in_progress':
      return 'InProgress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'onhold':
    case 'on_hold':
      return 'OnHold'
    default:
      return 'New'
  }
}

function getBuildiumPropertyIdFromTask(task: any): number | null {
  if (typeof task?.PropertyId === 'number') return task.PropertyId
  if (typeof task?.Property?.Id === 'number') return task.Property.Id
  return null
}

function getBuildiumUnitIdFromTask(task: any): number | null {
  if (typeof task?.UnitId === 'number') return task.UnitId
  return null
}

function getBuildiumCategoryFromTask(task: any): { id: number | null; name: string | null } {
  if (typeof task?.Category === 'string') {
    // legacy/simple shape treated as name
    return { id: null, name: task.Category }
  }
  if (task?.Category && typeof task.Category === 'object') {
    return {
      id: typeof task.Category.Id === 'number' ? task.Category.Id : null,
      name: typeof task.Category.Name === 'string' ? task.Category.Name : null
    }
  }
  return { id: null, name: null }
}

/**
 * Maps local task shape to Buildium basic / legacy Task create shape.
 * Use mapTaskToBuildiumV1 for OpenAPI v1 request shape.
 */
export function mapTaskToBuildium(localTask: any): BuildiumTaskCreate {
  return {
    PropertyId: localTask.buildium_property_id || localTask.property_id,
    UnitId: localTask.buildium_unit_id || localTask.unit_id || undefined,
    Subject: localTask.subject || localTask.title,
    Description: localTask.description || undefined,
    Category: localTask.category || localTask.category_id,
    Priority: mapTaskPriorityToBuildium(localTask.priority || 'Medium'),
    Status: mapTaskStatusToBuildium(localTask.status || 'Open'),
    AssignedTo: localTask.assigned_to || localTask.assigned_to_id || undefined
  }
}

/**
 * Maps a local task to the newer Buildium OpenAPI v1 request shape.
 * This returns a payload with Title, TaskStatus, AssignedToUserId, CategoryId, DueDate.
 */
export function mapTaskToBuildiumV1(localTask: any): any {
  const propertyId = localTask.buildium_property_id || localTask.property_id || null
  const unitId = localTask.buildium_unit_id || localTask.unit_id || null
  const assignedToId = localTask.assigned_to_id || localTask.assigned_to || null

  return sanitizeForBuildium({
    Title: localTask.subject || localTask.title,
    Description: localTask.description,
    PropertyId: typeof propertyId === 'number' ? propertyId : undefined,
    UnitId: typeof unitId === 'number' ? unitId : undefined,
    CategoryId: localTask.category_id || undefined,
    TaskStatus: localStatusToV1(localTask.status),
    Priority: mapTaskPriorityToBuildium(localTask.priority || 'Medium'),
    AssignedToUserId: typeof assignedToId === 'number' || /\d+/.test(`${assignedToId}`)
      ? Number(assignedToId)
      : undefined,
    DueDate: localTask.scheduled_date || localTask.due_date || undefined
  })
}

/**
 * Maps Buildium Task (both legacy/simple and OpenAPI v1 shapes) into local task row fields.
 * This synchronous variant does NOT resolve local property/unit UUIDs. Use
 * mapTaskFromBuildiumWithRelations() if you need relationships resolved.
 */
export function mapTaskFromBuildium(buildiumTask: any): any {
  const isV1 = isBuildiumTaskV1Shape(buildiumTask)
  const subject = isV1 ? (buildiumTask.Title || buildiumTask.Subject) : buildiumTask.Subject
  const description = buildiumTask.Description ?? null
  const priority = buildiumTask.Priority ? mapTaskPriorityFromBuildium(buildiumTask.Priority) : 'medium'
  const status = isV1
    ? v1TaskStatusToLocal(buildiumTask.TaskStatus)
    : mapTaskStatusFromBuildium(buildiumTask.Status)

  const category = getBuildiumCategoryFromTask(buildiumTask)
  const assignedTo = isV1
    ? (buildiumTask.AssignedToUserId != null ? String(buildiumTask.AssignedToUserId) : null)
    : (buildiumTask.AssignedTo ?? null)

  return sanitizeForBuildium({
    // NOTE: property_id and unit_id intentionally omitted here to avoid writing
    // Buildium numeric IDs into local UUID columns. Use the async variant below
    // to resolve and set local FKs.
    subject: subject,
    description: description,
    category: category.name ?? (category.id != null ? String(category.id) : undefined),
    priority,
    status,
    assigned_to: assignedTo,
    scheduled_date: isV1 ? (buildiumTask.DueDate ? normalizeDateString(buildiumTask.DueDate) : undefined) : (buildiumTask.ScheduledDate ? normalizeDateString(buildiumTask.ScheduledDate) : undefined),
    completed_date: buildiumTask.CompletedDate ? normalizeDateString(buildiumTask.CompletedDate) : undefined,
    buildium_task_id: buildiumTask.Id
  })
}

/**
 * Async variant that resolves local property_id/unit_id UUIDs using Supabase.
 */
export async function mapTaskFromBuildiumWithRelations(
  buildiumTask: any,
  supabase: any,
  options?: { taskKind?: 'owner' | 'resident' | 'contact' | 'todo' | 'other'; requireCategory?: boolean; defaultCategoryName?: string }
): Promise<any> {
  const base = mapTaskFromBuildium(buildiumTask)
  const buildiumPropertyId = getBuildiumPropertyIdFromTask(buildiumTask)
  const buildiumUnitId = getBuildiumUnitIdFromTask(buildiumTask)

  const [localPropertyId, localUnitId] = await Promise.all([
    resolveLocalPropertyId(buildiumPropertyId, supabase),
    resolveLocalUnitId(buildiumUnitId, supabase)
  ])

  // Resolve category and assigned staff if available
  let taskCategoryId = await ensureTaskCategoryFromTask(buildiumTask, supabase)
  const assignedToStaffId = await resolveStaffIdByBuildiumUserId(buildiumTask?.AssignedToUserId, supabase)

  // If To-Do kind and category required, ensure default when missing
  if (options?.taskKind === 'todo' && (!taskCategoryId || options?.requireCategory)) {
    const fallbackName = options?.defaultCategoryName || 'To-Do'
    taskCategoryId = taskCategoryId || (await ensureCategoryByName(fallbackName, supabase))
  }

  // Requested by (Owner/Resident/Contact)
  const requested = await buildRequestedByFields(buildiumTask?.RequestedByUserEntity, supabase)

  return sanitizeForBuildium({
    ...base,
    property_id: localPropertyId || undefined,
    unit_id: localUnitId || undefined,
    task_category_id: taskCategoryId || undefined,
    assigned_to_staff_id: assignedToStaffId || undefined,
    requested_by_contact_id: requested.requested_by_contact_id || undefined,
    requested_by_type: requested.requested_by_type || undefined,
    requested_by_buildium_id: requested.requested_by_buildium_id || undefined,
    task_kind: options?.taskKind || undefined,
    // Fallback Buildium IDs for backfill
    buildium_property_id: buildiumPropertyId || undefined,
    buildium_unit_id: buildiumUnitId || undefined,
    buildium_owner_id: requested.buildium_owner_id || undefined,
    buildium_tenant_id: requested.buildium_tenant_id || undefined,
    buildium_lease_id: buildiumTask?.LeaseId || undefined
  })
}

// ============================================================================
// TASK CATEGORY + REQUESTED BY + STAFF HELPERS
// ============================================================================

async function ensureTaskCategoryFromTask(task: any, supabase: any): Promise<string | null> {
  try {
    if (!task) return null
    const category = task?.Category
    // Plain string category name
    if (typeof category === 'string' && category.trim()) {
      const name = category.trim()
      const found = await supabase
        .from('task_categories')
        .select('id')
        .ilike('name', name)
        .maybeSingle()
      if (found.data?.id) return found.data.id
      const now = new Date().toISOString()
      const created = await supabase
        .from('task_categories')
        .insert({ name, is_active: true, created_at: now, updated_at: now })
        .select('id')
        .single()
      return created.data?.id ?? null
    }

    if (category && typeof category === 'object') {
      const parentIdNum = typeof category.Id === 'number' ? category.Id : null
      const parentName = typeof category.Name === 'string' ? category.Name : null
      const sub = category.SubCategory

      // Ensure parent category row
      let parentRowId: string | null = null
      if (parentIdNum || parentName) {
        const { data: existingParent } = await supabase
          .from('task_categories')
          .select('id')
          .or([
            parentIdNum ? `buildium_category_id.eq.${parentIdNum}` : 'buildium_category_id.is.null',
            parentName ? `name.ilike.${parentName}` : 'name.is.null'
          ].join(','))
          .maybeSingle()
        if (existingParent?.id) {
          parentRowId = existingParent.id
        } else {
          const now = new Date().toISOString()
          const { data: createdParent } = await supabase
            .from('task_categories')
            .insert({
              name: parentName || `Category ${parentIdNum}`,
              buildium_category_id: parentIdNum,
              is_active: true,
              created_at: now,
              updated_at: now
            })
            .select('id')
            .single()
          parentRowId = createdParent?.id ?? null
        }
      }

      // If we have a subcategory, ensure it as a child, return child
      const subIdNum = typeof sub?.Id === 'number' ? sub.Id : null
      const subName = typeof sub?.Name === 'string' ? sub.Name : null
      if (subIdNum || subName) {
        const { data: existingSub } = await supabase
          .from('task_categories')
          .select('id')
          .or([
            subIdNum ? `buildium_subcategory_id.eq.${subIdNum}` : 'buildium_subcategory_id.is.null',
            subName ? `name.ilike.${subName}` : 'name.is.null'
          ].join(','))
          .maybeSingle()
        if (existingSub?.id) return existingSub.id

        const now = new Date().toISOString()
        const { data: createdSub } = await supabase
          .from('task_categories')
          .insert({
            name: subName || `SubCategory ${subIdNum}`,
            buildium_subcategory_id: subIdNum,
            parent_id: parentRowId,
            is_active: true,
            created_at: now,
            updated_at: now
          })
          .select('id')
          .single()
        return createdSub?.id ?? parentRowId
      }
      // Otherwise return parent if present
      return parentRowId
    }
  } catch (err) {
    console.warn('ensureTaskCategoryFromTask error:', err)
  }
  return null
}

async function ensureCategoryByName(name: string, supabase: any): Promise<string | null> {
  const trimmed = (name || '').trim()
  if (!trimmed) return null
  const { data: existing } = await supabase
    .from('task_categories')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle()
  if (existing?.id) return existing.id
  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('task_categories')
    .insert({ name: trimmed, is_active: true, created_at: now, updated_at: now })
    .select('id')
    .single()
  if (error) return null
  return created?.id ?? null
}

async function resolveStaffIdByBuildiumUserId(buildiumUserId: any, supabase: any): Promise<number | null> {
  if (!buildiumUserId && buildiumUserId !== 0) return null
  const idNum = Number(buildiumUserId)
  if (!Number.isFinite(idNum)) return null
  const { data, error } = await supabase
    .from('staff')
    .select('id')
    .eq('buildium_user_id', idNum)
    .single()
  if (error && error.code !== 'PGRST116') {
    console.warn('resolveStaffIdByBuildiumUserId error:', error)
    return null
  }
  return data?.id ?? null
}

async function resolveOwnerIdByBuildiumOwnerId(buildiumOwnerId: any, supabase: any): Promise<string | null> {
  const idNum = Number(buildiumOwnerId)
  if (!Number.isFinite(idNum)) return null
  const { data, error } = await supabase
    .from('owners')
    .select('id')
    .eq('buildium_owner_id', idNum)
    .single()
  if (error && error.code !== 'PGRST116') return null
  return data?.id ?? null
}

async function resolveTenantIdByBuildiumTenantId(buildiumTenantId: any, supabase: any): Promise<string | null> {
  const idNum = Number(buildiumTenantId)
  if (!Number.isFinite(idNum)) return null
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('buildium_tenant_id', idNum)
    .single()
  if (error && error.code !== 'PGRST116') return null
  return data?.id ?? null
}

async function resolveContactIdForOwner(ownerId: string | null, supabase: any): Promise<number | null> {
  if (!ownerId) return null
  const { data, error } = await supabase
    .from('owners')
    .select('contact_id')
    .eq('id', ownerId)
    .single()
  if (error) return null
  return data?.contact_id ?? null
}

async function resolveContactIdForTenant(tenantId: string | null, supabase: any): Promise<number | null> {
  if (!tenantId) return null
  const { data, error } = await supabase
    .from('tenants')
    .select('contact_id')
    .eq('id', tenantId)
    .single()
  if (error) return null
  return data?.contact_id ?? null
}

async function ensureContactForBuildiumContact(entity: any, supabase: any): Promise<number | null> {
  try {
    if (!entity || typeof entity !== 'object') return null
    const buildiumContactId = Number(entity.Id)
    const isCompany = !!entity.IsCompany
    const firstName = entity.FirstName || null
    const lastName = entity.LastName || null
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || (isCompany ? 'Company' : 'Contact')

    if (Number.isFinite(buildiumContactId)) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('buildium_contact_id', buildiumContactId)
        .maybeSingle()
      if (existing?.id) return existing.id
    }
    const now = new Date().toISOString()
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        is_company: isCompany,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        buildium_contact_id: Number.isFinite(buildiumContactId) ? buildiumContactId : null,
        created_at: now,
        updated_at: now
      })
      .select('id')
      .single()
    if (error) return null
    return created?.id ?? null
  } catch (err) {
    console.warn('ensureContactForBuildiumContact error:', err)
    return null
  }
}

async function buildRequestedByFields(entity: any, supabase: any): Promise<{
  requested_by_contact_id: number | null
  requested_by_type: string | null
  requested_by_buildium_id: number | null
  buildium_owner_id: number | null
  buildium_tenant_id: number | null
}> {
  const result = {
    requested_by_contact_id: null as number | null,
    requested_by_type: null as string | null,
    requested_by_buildium_id: null as number | null,
    buildium_owner_id: null as number | null,
    buildium_tenant_id: null as number | null
  }
  if (!entity || typeof entity !== 'object') return result

  const type = String(entity.Type || '').trim() || null
  const idNum = Number(entity.Id)
  result.requested_by_type = type
  result.requested_by_buildium_id = Number.isFinite(idNum) ? idNum : null

  if (type?.toLowerCase().includes('owner')) {
    const ownerId = await resolveOwnerIdByBuildiumOwnerId(idNum, supabase)
    result.buildium_owner_id = Number.isFinite(idNum) ? idNum : null
    result.requested_by_contact_id = await resolveContactIdForOwner(ownerId, supabase)
  } else if (type?.toLowerCase().includes('resident') || type?.toLowerCase().includes('tenant')) {
    const tenantId = await resolveTenantIdByBuildiumTenantId(idNum, supabase)
    result.buildium_tenant_id = Number.isFinite(idNum) ? idNum : null
    result.requested_by_contact_id = await resolveContactIdForTenant(tenantId, supabase)
  } else if (type?.toLowerCase().includes('contact')) {
    // Generic contact; ensure we have a local contact row
    const contactId = await ensureContactForBuildiumContact(entity, supabase)
    if (contactId) result.requested_by_contact_id = contactId
  }

  return result
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
    // Legacy/simple shape retained for backward compatibility (not used for DB upsert)
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
// BILL → TRANSACTION UPSERT (with lines)
// ============================================================================

/**
 * Resolves a local vendor UUID by Buildium VendorId. If not found, attempts to fetch
 * from Buildium and create the vendor locally (with category/contact as needed).
 */
export async function resolveLocalVendorIdFromBuildium(
  buildiumVendorId: number | null | undefined,
  supabase: any
): Promise<string | null> {
  if (!buildiumVendorId) return null
  try {
    const { data: existing, error: findErr } = await supabase
      .from('vendors')
      .select('id')
      .eq('buildium_vendor_id', buildiumVendorId)
      .single()
    if (!findErr && existing) return existing.id
    if (findErr && findErr.code !== 'PGRST116') throw findErr

    // Fetch vendor from Buildium and create
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/vendors/${buildiumVendorId}`
    const resp = await fetch(buildiumUrl, {
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    })
    if (!resp.ok) return null
    const buildiumVendor = await resp.json()
    const vendorPayload = await mapVendorFromBuildiumWithCategory(buildiumVendor, supabase)
    const now = new Date().toISOString()
    const { data: created, error: createErr } = await supabase
      .from('vendors')
      .insert({ ...vendorPayload, created_at: now, updated_at: now })
      .select('id')
      .single()
    if (createErr) throw createErr
    return created.id
  } catch (e) {
    console.warn('Failed to resolve/create vendor from Buildium:', e)
    return null
  }
}

/**
 * Resolves a local bill category UUID by Buildium CategoryId (creates if missing)
 */
export async function resolveBillCategoryIdFromBuildium(
  buildiumCategoryId: number | null | undefined,
  supabase: any
): Promise<string | null> {
  if (!buildiumCategoryId) return null
  try {
    const { data: existing, error: findErr } = await supabase
      .from('bill_categories')
      .select('id')
      .eq('buildium_category_id', buildiumCategoryId)
      .single()
    if (!findErr && existing) return existing.id
    if (findErr && findErr.code !== 'PGRST116') throw findErr

    const now = new Date().toISOString()
    const { data: created, error: createErr } = await supabase
      .from('bill_categories')
      .insert({
        buildium_category_id: buildiumCategoryId,
        name: `Category ${buildiumCategoryId}`,
        created_at: now,
        updated_at: now
      })
      .select('id')
      .single()
    if (createErr) throw createErr
    return created.id
  } catch (e) {
    console.warn('Failed to resolve/create bill category:', e)
    return null
  }
}

/**
 * Maps a Buildium Bill to our transactions table shape (header only).
 */
export async function mapBillTransactionFromBuildium(
  buildiumBill: any,
  supabase: any
): Promise<any> {
  const nowIso = new Date().toISOString()
  const vendorId = await resolveLocalVendorIdFromBuildium(buildiumBill?.VendorId ?? null, supabase)
  const categoryId = await resolveBillCategoryIdFromBuildium(buildiumBill?.CategoryId ?? null, supabase)

  return {
    buildium_bill_id: buildiumBill?.Id ?? null,
    date: normalizeDateString(buildiumBill?.Date),
    due_date: buildiumBill?.DueDate ? normalizeDateString(buildiumBill?.DueDate) : null,
    paid_date: buildiumBill?.PaidDate ? normalizeDateString(buildiumBill?.PaidDate) : null,
    total_amount: Number(buildiumBill?.Amount ?? 0),
    reference_number: buildiumBill?.ReferenceNumber ?? null,
    memo: buildiumBill?.Description ?? null,
    transaction_type: 'Bill',
    status: mapBillStatusFromBuildium((buildiumBill?.Status as any) || 'Pending'),
    vendor_id: vendorId,
    category_id: categoryId,
    updated_at: nowIso
  }
}

/**
 * Upserts a Bill as a row in transactions (by buildium_bill_id),
 * then deletes and re-inserts all transaction_lines from Bill.Lines (if present).
 */
export async function upsertBillWithLines(
  buildiumBill: any,
  supabase: any
): Promise<{ transactionId: string }> {
  const nowIso = new Date().toISOString()
  const header = await mapBillTransactionFromBuildium(buildiumBill, supabase)

  // Find existing transaction by buildium_bill_id
  let existing: any = null
  {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('buildium_bill_id', header.buildium_bill_id)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    existing = data ?? null
  }

  let transactionId: string
  if (existing) {
    const { data, error } = await supabase
      .from('transactions')
      .update(header)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...header, created_at: nowIso })
      .select('id')
      .single()
    if (error) throw error
    transactionId = data.id
  }

  // Prepare and insert lines
  const lines: any[] = Array.isArray(buildiumBill?.Lines) ? buildiumBill.Lines : []
  const pendingLines: any[] = []
  for (const line of lines) {
    const amount = Number(line?.Amount ?? 0)
    const postingType = 'Debit' // Bills are expenses by default

    const glAccountBuildiumId = line?.GlAccountId ?? (typeof line?.GLAccount === 'number' ? line.GLAccount : line?.GLAccount?.Id)
    const glAccountId = await resolveGLAccountId(glAccountBuildiumId, supabase)
    if (!glAccountId) {
      throw new Error(`Failed to resolve GL account for bill line. Buildium GLAccountId: ${glAccountBuildiumId}`)
    }

    const buildiumPropertyId = line?.AccountingEntity?.Id ?? null
    const buildiumUnitId = line?.AccountingEntity?.Unit?.Id
      ?? line?.AccountingEntity?.UnitId
      ?? null
    const localPropertyId = await resolveLocalPropertyId(buildiumPropertyId, supabase)
    const localUnitId = await resolveLocalUnitId(buildiumUnitId, supabase)

    const entityTypeRaw = (line?.AccountingEntity?.AccountingEntityType || 'Rental') as string
    const entityType: 'Rental' | 'Company' = String(entityTypeRaw).toLowerCase() === 'rental' ? 'Rental' : 'Company'

    pendingLines.push({
      transaction_id: transactionId,
      gl_account_id: glAccountId,
      amount: Math.abs(amount),
      posting_type: postingType,
      memo: line?.Memo ?? null,
      account_entity_type: entityType,
      account_entity_id: buildiumPropertyId ?? null,
      date: normalizeDateString(buildiumBill?.Date),
      created_at: nowIso,
      updated_at: nowIso,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: null,
      property_id: localPropertyId,
      unit_id: localUnitId
    })
  }

  if (pendingLines.length > 0) {
    const totalAmount = pendingLines.reduce((sum, current) => sum + Number(current?.amount ?? 0), 0)
    if (totalAmount > 0) {
      const accountsPayableGlId = await resolveGLAccountId(7, supabase)
      if (accountsPayableGlId) {
        const sample = pendingLines[0] ?? {}
        pendingLines.push({
          transaction_id: transactionId,
          gl_account_id: accountsPayableGlId,
          amount: totalAmount,
          posting_type: 'Credit',
          memo: buildiumBill?.Memo ?? sample?.memo ?? null,
          account_entity_type: sample?.account_entity_type ?? 'Company',
          account_entity_id: sample?.account_entity_id ?? null,
          date: normalizeDateString(buildiumBill?.Date),
          created_at: nowIso,
          updated_at: nowIso,
          buildium_property_id: sample?.buildium_property_id ?? null,
          buildium_unit_id: sample?.buildium_unit_id ?? null,
          buildium_lease_id: null,
          property_id: sample?.property_id ?? null,
          unit_id: sample?.unit_id ?? null
        })
      }
    }
  }

  // Replace existing lines
  {
    const { error } = await supabase
      .from('transaction_lines')
      .delete()
      .eq('transaction_id', transactionId)
    if (error) throw error
  }

  if (pendingLines.length > 0) {
    const { error } = await supabase
      .from('transaction_lines')
      .insert(pendingLines)
    if (error) throw error
  }

  return { transactionId }
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
 * @see mapGLAccountFromBuildiumWithSubAccounts
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

  const result = {
    ...baseGLAccount,
    sub_accounts: subAccounts
  };

  // Validate relationships and log results
  const validation = validateGLAccountRelationships(result, buildiumGLAccount);
  logValidationResults(validation, `GL Account ${buildiumGLAccount.Id} (${buildiumGLAccount.Name})`);

  return result;
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
 * @see mapBankAccountFromBuildiumWithGLAccount
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
    buildium_balance: buildiumBankAccount.Balance,
    country: mapCountryFromBuildium(buildiumBankAccount.Country) || null,
    check_printing_info: buildiumBankAccount.CheckPrintingInfo || null,
    electronic_payments: buildiumBankAccount.ElectronicPayments || null
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

  const result = {
    ...baseBankAccount,
    gl_account: glAccountId
  };

  // Validate relationships and log results
  const validation = validateBankAccountRelationships(result, buildiumBankAccount);
  logValidationResults(validation, `Bank Account ${buildiumBankAccount.Id} (${buildiumBankAccount.Name})`);

  return result;
}

function mapBankAccountTypeToBuildium(localType: string): 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit' {
  const normalized = (localType || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // normalize spaces/hyphens to underscores
    .replace(/^_+|_+$/g, '')

  switch (normalized) {
    case 'savings':
    case 'business_savings':
      return 'Savings'
    case 'money_market':
    case 'moneymarket':
    case 'money_market_account':
      return 'MoneyMarket'
    case 'certificate_of_deposit':
    case 'certificateofdeposit':
    case 'cd':
      return 'CertificateOfDeposit'
    // Treat business/trust/escrow checking types as Checking in Buildium
    case 'checking':
    case 'business_checking':
    case 'trust_account':
    case 'escrow_account':
      return 'Checking'
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

type NormalizedBuildiumDate = { iso: string; dateOnly: string }

export function mapLeaseToBuildium(localLease: any): BuildiumLeaseCreate {
  // If the input already looks like a Buildium-shaped payload (has LeaseFromDate),
  // pass through only the keys supported by the create-lease schema without re-deriving.
  if (localLease && typeof localLease.LeaseFromDate === 'string') {
    const out: any = {
      LeaseFromDate: String(localLease.LeaseFromDate)
    }
    if (localLease.LeaseType) out.LeaseType = localLease.LeaseType
    if (localLease.LeaseToDate) out.LeaseToDate = String(localLease.LeaseToDate)
    if (localLease.UnitId != null) out.UnitId = Number(localLease.UnitId)
    if (localLease.SendWelcomeEmail !== undefined) out.SendWelcomeEmail = Boolean(localLease.SendWelcomeEmail)
    if (localLease.Tenants) out.Tenants = localLease.Tenants
    if (localLease.TenantIds) out.TenantIds = localLease.TenantIds
    if (localLease.ApplicantIds) out.ApplicantIds = localLease.ApplicantIds
    if (localLease.Cosigners) out.Cosigners = localLease.Cosigners
    if (localLease.Rent) out.Rent = localLease.Rent
    if (localLease.SecurityDeposit) out.SecurityDeposit = localLease.SecurityDeposit
    if (localLease.ProratedFirstMonthRent != null) out.ProratedFirstMonthRent = localLease.ProratedFirstMonthRent
    if (localLease.ProratedLastMonthRent != null) out.ProratedLastMonthRent = localLease.ProratedLastMonthRent
    return out as BuildiumLeaseCreate
  }
  // PropertyId is not required for Buildium lease create; UnitId implies the property.
  // Keep resolving it for internal logic if needed, but do not include it in payload.
  const unitId = coerceNumber(localLease.buildium_unit_id ?? localLease.UnitId ?? localLease.unit_id)

  const leaseFrom = normalizeBuildiumDate(localLease.lease_from_date ?? localLease.StartDate)
  if (!leaseFrom) {
    throw new Error('Lease start date is required for Buildium payload')
  }
  const leaseTo = normalizeBuildiumDate(localLease.lease_to_date ?? localLease.EndDate, { allowNull: true })

  const rentAmount = coerceNumber(localLease.rent_amount ?? localLease.RentAmount)
  if (rentAmount == null) throw new Error('Cannot map lease to Buildium without rent_amount / RentAmount')

  const securityDeposit = coerceNumber(localLease.security_deposit ?? localLease.SecurityDepositAmount)

  const leaseType = normalizeLeaseTypeForBuildium(localLease.lease_type ?? localLease.LeaseType)
  const sendWelcomeEmail = Boolean(localLease.send_welcome_email ?? localLease.SendWelcomeEmail ?? false)

  // Strict payload: only use keys present in the sample schema.
  const payload: BuildiumLeaseCreate = {
    LeaseFromDate: leaseFrom.dateOnly,
    LeaseType: leaseType,
    SendWelcomeEmail: sendWelcomeEmail
  }

  if (unitId != null) payload.UnitId = unitId
  if (leaseTo) payload.LeaseToDate = leaseTo.dateOnly

  // Do not include RentAmount/SecurityDepositAmount or any other
  // non-sample fields here; amounts are carried in Rent and SecurityDeposit blocks.

  const tenantIdsInput =
    (localLease as any).TenantIds ??
    (localLease as any).tenantIds ??
    (localLease as any).tenant_ids

  if (Array.isArray(tenantIdsInput)) {
    const tenantIds = tenantIdsInput
      .map((value: unknown) => coerceNumber(value))
      .filter((value: number | null): value is number => value != null)

    if (tenantIds.length) payload.TenantIds = Array.from(new Set(tenantIds))
  }

  const applicantIdsInput =
    (localLease as any).ApplicantIds ??
    (localLease as any).applicantIds ??
    (localLease as any).applicant_ids

  if (Array.isArray(applicantIdsInput)) {
    const applicantIds = applicantIdsInput
      .map((value: unknown) => coerceNumber(value))
      .filter((value: number | null): value is number => value != null)

    if (applicantIds.length) payload.ApplicantIds = Array.from(new Set(applicantIds))
  }

  const tenantDetailsInput =
    (localLease as any).Tenants ??
    (localLease as any).tenants ??
    (localLease as any).tenantDetails ??
    (localLease as any).tenant_details

  if (Array.isArray(tenantDetailsInput)) {
    const tenantDetails = tenantDetailsInput
      .map((tenant: any) => sanitizeForBuildium(tenant))
      .filter((tenant: Record<string, any>) => tenant && Object.keys(tenant).length > 0)

    if (tenantDetails.length) payload.Tenants = tenantDetails
  }

  return payload
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
    // term_type removed in favor of lease_type enum
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

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeBuildiumDate(value: unknown, options: { allowNull?: boolean } = {}): NormalizedBuildiumDate | undefined {
  if (value === null || value === undefined) {
    if (options.allowNull) return undefined
    throw new Error('Lease start date is required for Buildium payload')
  }
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    if (options.allowNull) return undefined
    throw new Error(`Invalid date provided for Buildium lease payload: ${value}`)
  }
  const iso = date.toISOString()
  return {
    iso,
    dateOnly: iso.slice(0, 10)
  }
}

function normalizeLeaseTypeForBuildium(value: unknown): BuildiumLeaseType {
  const normalized = typeof value === 'string' ? value.toLowerCase().replace(/[\s_-]+/g, '') : ''
  switch (normalized) {
    case 'fixedwithrollover':
      return 'FixedWithRollover'
    case 'atwill':
      return 'AtWill'
    case 'monthtomonth':
      return 'MonthToMonth'
    case 'other':
      return 'Other'
    case 'fixed':
    case 'fixedterm':
    default:
      return 'Fixed'
  }
}

function normalizeLeaseTermTypeForBuildium(value: unknown): BuildiumLeaseTermType | undefined {
  const normalized = typeof value === 'string' ? value.toLowerCase().replace(/[\s_-]+/g, '') : ''
  switch (normalized) {
    case 'monthtomonth':
      return 'MonthToMonth'
    case 'weektoweek':
      return 'WeekToWeek'
    case 'atwill':
      return 'AtWill'
    case 'other':
      return 'Other'
    case 'fixed':
    case 'fixedterm':
    case 'fixedwithrollover':
    case 'standard':
      return 'Standard'
    default:
      return undefined
  }
}

function normalizeLeaseRenewalStatusForBuildium(value: unknown): BuildiumLeaseRenewalStatus | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, '')
  switch (normalized) {
    case 'offered':
      return 'Offered'
    case 'accepted':
      return 'Accepted'
    case 'declined':
      return 'Declined'
    case 'expired':
      return 'Expired'
    case 'notoffered':
      return 'NotOffered'
    default:
      return undefined
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
// RUNTIME VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that property data has proper relationships resolved
 * @param propertyData - The mapped property data
 * @param buildiumProperty - Original Buildium property data
 * @returns ValidationResult indicating if relationships are properly resolved
 */
export function validatePropertyRelationships(propertyData: any, buildiumProperty: any): {
  isValid: boolean
  warnings: string[]
  errors: string[]
} {
  const warnings: string[] = []
  const errors: string[] = []

  // Check if OperatingBankAccountId exists in Buildium but not resolved locally
  if (buildiumProperty.OperatingBankAccountId && !propertyData.operating_bank_account_id) {
    warnings.push(`Property ${buildiumProperty.Id} has OperatingBankAccountId ${buildiumProperty.OperatingBankAccountId} in Buildium but no operating_bank_account_id was resolved locally`)
  }

  // Check if property has required fields
  if (!propertyData.name) {
    errors.push('Property name is required but missing')
  }
  if (!propertyData.buildium_property_id) {
    errors.push('Buildium property ID is required but missing')
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

/**
 * Validates that bank account data has proper relationships resolved
 * @param bankAccountData - The mapped bank account data
 * @param buildiumBankAccount - Original Buildium bank account data
 * @returns ValidationResult indicating if relationships are properly resolved
 */
export function validateBankAccountRelationships(bankAccountData: any, buildiumBankAccount: any): {
  isValid: boolean
  warnings: string[]
  errors: string[]
} {
  const warnings: string[] = []
  const errors: string[] = []

  // Check if GLAccount.Id exists in Buildium but not resolved locally
  if (buildiumBankAccount.GLAccount?.Id && !bankAccountData.gl_account) {
    warnings.push(`Bank account ${buildiumBankAccount.Id} has GLAccount.Id ${buildiumBankAccount.GLAccount.Id} in Buildium but no gl_account was resolved locally`)
  }

  // Check if bank account has required fields
  if (!bankAccountData.name) {
    errors.push('Bank account name is required but missing')
  }
  if (!bankAccountData.buildium_bank_id) {
    errors.push('Buildium bank ID is required but missing')
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

/**
 * Validates that GL account data has proper relationships resolved
 * @param glAccountData - The mapped GL account data
 * @param buildiumGLAccount - Original Buildium GL account data
 * @returns ValidationResult indicating if relationships are properly resolved
 */
export function validateGLAccountRelationships(glAccountData: any, buildiumGLAccount: any): {
  isValid: boolean
  warnings: string[]
  errors: string[]
} {
  const warnings: string[] = []
  const errors: string[] = []

  // Check if SubAccounts exists in Buildium but not resolved locally
  if (buildiumGLAccount.SubAccounts && buildiumGLAccount.SubAccounts.length > 0) {
    if (!glAccountData.sub_accounts || glAccountData.sub_accounts.length === 0) {
      warnings.push(`GL account ${buildiumGLAccount.Id} has ${buildiumGLAccount.SubAccounts.length} SubAccounts in Buildium but no sub_accounts were resolved locally`)
    } else if (glAccountData.sub_accounts.length !== buildiumGLAccount.SubAccounts.length) {
      warnings.push(`GL account ${buildiumGLAccount.Id} has ${buildiumGLAccount.SubAccounts.length} SubAccounts in Buildium but only ${glAccountData.sub_accounts.length} were resolved locally`)
    }
  }

  // Check if GL account has required fields
  if (!glAccountData.name) {
    errors.push('GL account name is required but missing')
  }
  if (!glAccountData.buildium_gl_account_id) {
    errors.push('Buildium GL account ID is required but missing')
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

/**
 * Logs validation results with appropriate log levels
 * @param validation - Validation result object
 * @param context - Context information for logging
 */
export function logValidationResults(validation: { isValid: boolean; warnings: string[]; errors: string[] }, context: string): void {
  if (validation.errors.length > 0) {
    console.error(`❌ Validation errors for ${context}:`, validation.errors)
  }
  
  if (validation.warnings.length > 0) {
    console.warn(`⚠️  Validation warnings for ${context}:`, validation.warnings)
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log(`✅ Validation passed for ${context}`)
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
// WORK ORDER MAPPING FUNCTIONS
// ============================================================================

function mapWorkOrderPriorityFromBuildium(priority: BuildiumWorkOrderPriority | undefined): string | null {
  if (!priority) return null
  switch (priority) {
    case 'Low': return 'low'
    case 'Medium': return 'medium'
    case 'High': return 'high'
    case 'Urgent': return 'urgent'
    default: return String(priority).toLowerCase()
  }
}

function mapWorkOrderStatusFromBuildium(status: BuildiumWorkOrderStatus | undefined): string | null {
  if (!status) return null
  switch (status) {
    case 'New': return 'open'
    case 'InProgress': return 'in_progress'
    case 'Completed': return 'completed'
    case 'Cancelled': return 'cancelled'
    default: return String(status).toLowerCase()
  }
}

async function resolveLocalPropertyIdFromBuildium(buildiumPropertyId: number | null | undefined, supabase: any): Promise<string | null> {
  return resolveLocalPropertyId(buildiumPropertyId ?? null, supabase)
}

async function resolveLocalUnitIdFromBuildium(buildiumUnitId: number | null | undefined, supabase: any): Promise<string | null> {
  return resolveLocalUnitId(buildiumUnitId ?? null, supabase)
}

async function resolveBuildiumPropertyIdFromLocal(localPropertyId: string | null | undefined, supabase: any): Promise<number | null> {
  if (!localPropertyId) return null
  const { data, error } = await supabase
    .from('properties')
    .select('buildium_property_id')
    .eq('id', localPropertyId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.buildium_property_id ?? null
}

async function resolveBuildiumUnitIdFromLocal(localUnitId: string | null | undefined, supabase: any): Promise<number | null> {
  if (!localUnitId) return null
  const { data, error } = await supabase
    .from('units')
    .select('buildium_unit_id')
    .eq('id', localUnitId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.buildium_unit_id ?? null
}

export function mapWorkOrderFromBuildium(buildiumWO: BuildiumWorkOrder): any {
  const subject = buildiumWO.Subject || buildiumWO.Title || ''
  return {
    buildium_work_order_id: buildiumWO.Id,
    subject,
    description: buildiumWO.Description ?? null,
    priority: mapWorkOrderPriorityFromBuildium(buildiumWO.Priority),
    status: mapWorkOrderStatusFromBuildium(buildiumWO.WorkOrderStatus),
    assigned_to: buildiumWO.AssignedToUserId ? String(buildiumWO.AssignedToUserId) : null,
    estimated_cost: null,
    actual_cost: null,
    scheduled_date: buildiumWO.DueDate ? new Date(buildiumWO.DueDate).toISOString() : null,
    completed_date: null,
    category: buildiumWO.Category?.Name ?? null,
    notes: null,
    // property_id/unit_id are resolved in the WithRelations variant
    property_id: null,
    unit_id: null,
    created_at: buildiumWO.CreatedDateTime ?? new Date().toISOString(),
    updated_at: buildiumWO.LastUpdatedDateTime ?? new Date().toISOString()
  }
}

export async function mapWorkOrderFromBuildiumWithRelations(buildiumWO: BuildiumWorkOrder, supabase: any): Promise<any> {
  const base = mapWorkOrderFromBuildium(buildiumWO)
  const localPropertyId = await resolveLocalPropertyIdFromBuildium(buildiumWO.Property?.Id, supabase)
  const localUnitId = await resolveLocalUnitIdFromBuildium(buildiumWO.UnitId ?? null, supabase)
  return {
    ...base,
    property_id: localPropertyId,
    unit_id: localUnitId
  }
}

export async function mapWorkOrderToBuildium(
  localWO: any,
  supabase: any
): Promise<BuildiumWorkOrderCreate | BuildiumWorkOrderUpdate> {
  // Resolve Buildium IDs from local UUIDs if provided
  const buildiumPropertyId = await resolveBuildiumPropertyIdFromLocal(localWO.property_id ?? null, supabase)
  const buildiumUnitId = await resolveBuildiumUnitIdFromLocal(localWO.unit_id ?? null, supabase)

  // Build fields compatible with our validated schemas and Buildium API
  const payload: BuildiumWorkOrderCreate | BuildiumWorkOrderUpdate = {
    PropertyId: buildiumPropertyId || localWO.PropertyId || localWO.propertyId,
    UnitId: buildiumUnitId || localWO.UnitId || localWO.unitId,
    // Support Subject or Title
    Subject: localWO.subject || localWO.Subject || localWO.Title,
    Title: localWO.Title || localWO.subject || localWO.Subject,
    Description: localWO.description || localWO.Description,
    Priority: localWO.priority
      ? (String(localWO.priority).charAt(0).toUpperCase() + String(localWO.priority).slice(1)) as BuildiumWorkOrderPriority
      : (localWO.Priority as BuildiumWorkOrderPriority | undefined),
    AssignedToUserId: localWO.AssignedToUserId || (localWO.assigned_to ? Number(localWO.assigned_to) : undefined),
    DueDate: localWO.due_date || localWO.DueDate,
    Category: localWO.category || localWO.Category,
    Notes: localWO.notes || localWO.Notes,
    EstimatedCost: localWO.estimated_cost || localWO.EstimatedCost,
    ScheduledDate: localWO.scheduled_date || localWO.ScheduledDate,
  }

  // Status and ActualCost/CompletedDate only for updates
  if (localWO.status || localWO.WorkOrderStatus) {
    (payload as BuildiumWorkOrderUpdate).WorkOrderStatus = ((): BuildiumWorkOrderStatus | undefined => {
      const s = (localWO.status || localWO.WorkOrderStatus || '').toString().toLowerCase()
      if (s === 'open' || s === 'new') return 'New'
      if (s === 'in_progress') return 'InProgress'
      if (s === 'completed') return 'Completed'
      if (s === 'cancelled') return 'Cancelled'
      return undefined
    })()
  }
  if (localWO.actual_cost || localWO.ActualCost) {
    (payload as BuildiumWorkOrderUpdate).ActualCost = localWO.actual_cost || localWO.ActualCost
  }
  if (localWO.completed_date || localWO.CompletedDate) {
    (payload as BuildiumWorkOrderUpdate).CompletedDate = localWO.completed_date || localWO.CompletedDate
  }

  return sanitizeForBuildium(payload)
}

// ============================================================================
// TENANT MAPPING FUNCTIONS
// ============================================================================

/**
 * Maps a Buildium tenant to database contact format
 * Handles phone numbers, country mapping, and data type conversions
 */
export function mapTenantToContact(buildiumTenant: any): any {
  // Handle phone numbers (array or object)
  let mobilePhone = ''
  let homePhone = ''
  let workPhone = ''
  const pn = buildiumTenant.PhoneNumbers
  if (Array.isArray(pn)) {
    mobilePhone = pn.find((p: any) => /cell|mobile/i.test(String(p?.Type)))?.Number || ''
    homePhone = pn.find((p: any) => /home/i.test(String(p?.Type)))?.Number || ''
    workPhone = pn.find((p: any) => /work/i.test(String(p?.Type)))?.Number || ''
  } else if (pn && typeof pn === 'object') {
    mobilePhone = pn.Mobile || ''
    homePhone = pn.Home || ''
    workPhone = pn.Work || ''
  }

  // Determine primary and alternate phone
  const primaryPhone = mobilePhone || homePhone || ''
  const altPhone = workPhone || homePhone || ''

  // Convert date format
  const dateOfBirth = buildiumTenant.DateOfBirth 
    ? new Date(buildiumTenant.DateOfBirth).toISOString().split('T')[0]
    : null

  const primaryAddress = buildiumTenant.PrimaryAddress || buildiumTenant.Address || {}
  const altAddress = buildiumTenant.AlternateAddress || {}

  return {
    is_company: !!buildiumTenant.IsCompany,
    first_name: buildiumTenant.FirstName || '',
    last_name: buildiumTenant.LastName || '',
    company_name: buildiumTenant.CompanyName || null,
    primary_email: buildiumTenant.Email || '',
    alt_email: buildiumTenant.AlternateEmail || '',
    primary_phone: primaryPhone,
    alt_phone: altPhone,
    date_of_birth: dateOfBirth,
    primary_address_line_1: primaryAddress?.AddressLine1 || '',
    primary_address_line_2: primaryAddress?.AddressLine2 || '',
    primary_address_line_3: primaryAddress?.AddressLine3 || '',
    primary_city: primaryAddress?.City || '',
    primary_state: primaryAddress?.State || '',
    primary_postal_code: primaryAddress?.PostalCode || '',
    primary_country: mapCountryFromBuildium(primaryAddress?.Country),
    alt_address_line_1: altAddress?.AddressLine1 || '',
    alt_address_line_2: altAddress?.AddressLine2 || '',
    alt_address_line_3: altAddress?.AddressLine3 || '',
    alt_city: altAddress?.City || '',
    alt_state: altAddress?.State || '',
    alt_postal_code: altAddress?.PostalCode || '',
    alt_country: mapCountryFromBuildium(altAddress?.Country),
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

// ============================================================================
// APPLIANCE MAPPING FUNCTIONS
// ============================================================================

import type {
  BuildiumAppliance,
  BuildiumApplianceCreate,
  BuildiumApplianceUpdate,
} from '../types/buildium'

/**
 * Map Buildium Appliance to local `appliances` row shape (without id fields)
 */
export async function mapApplianceFromBuildium(
  appliance: BuildiumAppliance,
  supabase: any
): Promise<any> {
  const unitId = await resolveLocalUnitId(appliance.UnitId ?? null, supabase)
  const propertyId = await resolveLocalPropertyId(appliance.PropertyId ?? null, supabase)
  return {
    buildium_appliance_id: appliance.Id,
    unit_id: unitId,
    property_id: propertyId,
    name: appliance.Name || appliance.ApplianceType || 'Appliance',
    type: String(appliance.ApplianceType || ''),
    manufacturer: appliance.Manufacturer ?? null,
    model_number: appliance.Model ?? null,
    serial_number: appliance.SerialNumber ?? null,
    installation_date: appliance.InstallationDate ? new Date(appliance.InstallationDate).toISOString().slice(0, 10) : null,
    warranty_expiration_date: appliance.WarrantyExpirationDate ? new Date(appliance.WarrantyExpirationDate).toISOString().slice(0, 10) : null,
    description: appliance.Description ?? null,
    is_active: typeof appliance.IsActive === 'boolean' ? appliance.IsActive : true,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
}

/**
 * Map local appliance record to Buildium create/update payload.
 * Requires the unit's Buildium UnitId and property Buildium PropertyId.
 */
export async function mapApplianceToBuildium(
  local: any,
  supabase: any
): Promise<BuildiumApplianceCreate | BuildiumApplianceUpdate> {
  // Resolve Buildium PropertyId and UnitId from local relations if not provided
  let buildiumUnitId: number | null = null
  if (local.buildium_unit_id) buildiumUnitId = Number(local.buildium_unit_id)
  if (!buildiumUnitId && local.unit_id) {
    const { data: u } = await supabase
      .from('units')
      .select('buildium_unit_id, property_id')
      .eq('id', local.unit_id)
      .single()
    buildiumUnitId = u?.buildium_unit_id ?? null
  }

  let buildiumPropertyId: number | null = null
  if (local.buildium_property_id) buildiumPropertyId = Number(local.buildium_property_id)
  if (!buildiumPropertyId && local.property_id) {
    const { data } = await supabase
      .from('properties')
      .select('buildium_property_id')
      .eq('id', local.property_id)
      .single()
    buildiumPropertyId = data?.buildium_property_id ?? null
  }

  // If still no property id, try infer from unit
  if (!buildiumPropertyId && local.unit_id) {
    const { data: u } = await supabase
      .from('units')
      .select('property_id')
      .eq('id', local.unit_id)
      .single()
    if (u?.property_id) {
      const { data: p } = await supabase
        .from('properties')
        .select('buildium_property_id')
        .eq('id', u.property_id)
        .single()
      buildiumPropertyId = p?.buildium_property_id ?? null
    }
  }

  const payload: BuildiumApplianceCreate = {
    PropertyId: Number(buildiumPropertyId || local.PropertyId || 0),
    UnitId: buildiumUnitId || local.UnitId || undefined,
    Name: local.name || local.Name || 'Appliance',
    Description: local.description || local.Description || undefined,
    ApplianceType: (local.ApplianceType || local.type) as any,
    Manufacturer: local.manufacturer || local.Manufacturer || undefined,
    Model: local.model_number || local.Model || undefined,
    SerialNumber: local.serial_number || local.SerialNumber || undefined,
    InstallationDate: local.installation_date || local.InstallationDate || undefined,
    WarrantyExpirationDate: local.warranty_expiration_date || local.WarrantyExpirationDate || undefined,
    IsActive: typeof local.is_active === 'boolean' ? local.is_active : (local.IsActive ?? true)
  }

  // Remove undefined keys for Buildium
  const out: any = { ...payload }
  Object.keys(out).forEach(k => out[k] == null && delete out[k])
  return out
}
