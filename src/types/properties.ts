// TypeScript interfaces for the Properties table
// These match the database schema defined in the migration

export type CountryEnum = 
  | 'Afghanistan' | 'Akrotiri' | 'Albania' | 'Algeria' | 'AmericanSamoa' | 'Andorra' | 'Angola' | 'Anguilla' | 'Antarctica' | 'AntiguaandBarbuda'
  | 'Argentina' | 'Armenia' | 'Aruba' | 'AshmoreandCartierIslands' | 'Australia' | 'Austria' | 'Azerbaijan' | 'Bahamas' | 'Bahrain' | 'Bangladesh'
  | 'Barbados' | 'BassasdaIndia' | 'Belarus' | 'Belgium' | 'Belize' | 'Benin' | 'Bermuda' | 'Bhutan' | 'Bolivia' | 'BosniaandHerzegovina' | 'Botswana'
  | 'BouvetIsland' | 'Brazil' | 'BritishIndianOceanTerritory' | 'BritishVirginIslands' | 'Brunei' | 'Bulgaria' | 'BurkinaFaso' | 'Burma' | 'Burundi'
  | 'Cambodia' | 'Cameroon' | 'Canada' | 'CapeVerde' | 'CaymanIslands' | 'CentralAfricanRepublic' | 'Chad' | 'Chile' | 'China' | 'ChristmasIsland'
  | 'ClippertonIsland' | 'CocosIslands' | 'Colombia' | 'Comoros' | 'DemocraticRepublicOfTheCongo' | 'RepublicOfTheCongo' | 'CookIslands'
  | 'CoralSeaIslands' | 'CostaRica' | 'CotedIvoire' | 'Croatia' | 'Cuba' | 'Cyprus' | 'CzechRepublic' | 'Denmark' | 'Dhekelia' | 'Djibouti' | 'Dominica'
  | 'DominicanRepublic' | 'Ecuador' | 'Egypt' | 'ElSalvador' | 'EquatorialGuinea' | 'Eritrea' | 'Estonia' | 'Ethiopia' | 'EuropaIsland'
  | 'FalklandIslands' | 'FaroeIslands' | 'Fiji' | 'Finland' | 'France' | 'FrenchGuiana' | 'FrenchPolynesia' | 'FrenchSouthernandAntarcticLands'
  | 'Gabon' | 'Gambia' | 'GazaStrip' | 'Georgia' | 'Germany' | 'Ghana' | 'Gibraltar' | 'GloriosoIslands' | 'Greece' | 'Greenland' | 'Grenada' | 'Guadeloupe'
  | 'Guam' | 'Guatemala' | 'Guernsey' | 'Guinea' | 'GuineaBissau' | 'Guyana' | 'Haiti' | 'HeardIslandandMcDonaldIslands' | 'VaticanCity' | 'Honduras'
  | 'HongKong' | 'Hungary' | 'Iceland' | 'India' | 'Indonesia' | 'Iran' | 'Iraq' | 'Ireland' | 'IsleofMan' | 'Israel' | 'Italy' | 'Jamaica' | 'JanMayen'
  | 'Japan' | 'Jersey' | 'Jordan' | 'JuandeNovaIsland' | 'Kazakhstan' | 'Kenya' | 'Kiribati' | 'NorthKorea' | 'SouthKorea' | 'Kuwait' | 'Kyrgyzstan'
  | 'Laos' | 'Latvia' | 'Lebanon' | 'Lesotho' | 'Liberia' | 'Libya' | 'Liechtenstein' | 'Lithuania' | 'Luxembourg' | 'Macau' | 'Macedonia' | 'Madagascar'
  | 'Malawi' | 'Malaysia' | 'Maldives' | 'Mali' | 'Malta' | 'MarshallIslands' | 'Martinique' | 'Mauritania' | 'Mauritius' | 'Mayotte' | 'Mexico'
  | 'Micronesia' | 'Moldova' | 'Monaco' | 'Mongolia' | 'Montserrat' | 'Morocco' | 'Mozambique' | 'Namibia' | 'Nauru' | 'NavassaIsland' | 'Nepal'
  | 'Netherlands' | 'NetherlandsAntilles' | 'NewCaledonia' | 'NewZealand' | 'Nicaragua' | 'Niger' | 'Nigeria' | 'Niue' | 'NorfolkIsland'
  | 'NorthernMarianaIslands' | 'Norway' | 'Oman' | 'Pakistan' | 'Palau' | 'Panama' | 'PapuaNewGuinea' | 'ParacelIslands' | 'Paraguay' | 'Peru'
  | 'Philippines' | 'PitcairnIslands' | 'Poland' | 'Portugal' | 'PuertoRico' | 'Qatar' | 'Reunion' | 'Romania' | 'Russia' | 'Rwanda' | 'SaintHelena'
  | 'SaintKittsandNevis' | 'SaintLucia' | 'SaintPierreandMiquelon' | 'SaintVincentandtheGrenadines' | 'Samoa' | 'SanMarino' | 'SaoTomeandPrincipe'
  | 'SaudiArabia' | 'Senegal' | 'SerbiaandMontenegro' | 'Seychelles' | 'SierraLeone' | 'Singapore' | 'Slovakia' | 'Slovenia' | 'SolomonIslands'
  | 'Somalia' | 'SouthAfrica' | 'SouthGeorgiaandtheSouthSandwichIslands' | 'Spain' | 'SpratlyIslands' | 'SriLanka' | 'Sudan' | 'Suriname'
  | 'Svalbard' | 'Swaziland' | 'Sweden' | 'Switzerland' | 'Syria' | 'Taiwan' | 'Tajikistan' | 'Tanzania' | 'Thailand' | 'TimorLeste' | 'Togo' | 'Tokelau'
  | 'Tonga' | 'TrinidadandTobago' | 'TromelinIsland' | 'Tunisia' | 'Turkey' | 'Turkmenistan';

export type RentalSubTypeEnum = 
  | 'CondoTownhome' 
  | 'MultiFamily' 
  | 'SingleFamily' 
  | 'Industrial' 
  | 'Office' 
  | 'Retail' 
  | 'ShoppingCenter' 
  | 'Storage' 
  | 'ParkingSpace';

export interface Property {
  // Primary key
  id: string; // UUID
  
  // Basic property information
  name: string; // VARCHAR(127), NOT NULL
  structure_description?: string; // TEXT, NULL
  
  // Address information
  address_line1: string; // VARCHAR(100), NOT NULL
  address_line2?: string; // VARCHAR(100), NULL
  address_line3?: string; // VARCHAR(100), NULL
  city?: string; // VARCHAR(100), NULL
  state?: string; // VARCHAR(100), NULL
  postal_code: string; // VARCHAR(20), NOT NULL
  country: CountryEnum; // country_enum, NOT NULL
  
  // Integration and business fields
  buildium_property_id?: number; // INTEGER, NULL
  rental_sub_type: RentalSubTypeEnum; // rental_sub_type_enum, NOT NULL
  rental_owner_ids?: number[]; // INTEGER[], NULL
  operating_bank_account_id: number; // INTEGER, NOT NULL
  reserve?: number; // NUMERIC(12,2), NULL
  year_built?: number; // INTEGER, NULL (1000-current year)
  
  // Timestamps
  created_at: string; // TIMESTAMP WITH TIME ZONE, NOT NULL
  updated_at: string; // TIMESTAMP WITH TIME ZONE, NOT NULL
}

export interface CreatePropertyRequest {
  name: string;
  structure_description?: string;
  address_line1: string;
  address_line2?: string;
  address_line3?: string;
  city?: string;
  state?: string;
  postal_code: string;
  country: CountryEnum;
  buildium_property_id?: number;
  rental_sub_type: RentalSubTypeEnum;
  rental_owner_ids?: number[];
  operating_bank_account_id: number;
  reserve?: number;
  year_built?: number;
}

export interface UpdatePropertyRequest extends Partial<CreatePropertyRequest> {
  id: string;
}

// Utility types for form handling
export interface PropertyFormData {
  name: string;
  structure_description: string;
  address_line1: string;
  address_line2: string;
  address_line3: string;
  city: string;
  state: string;
  postal_code: string;
  country: CountryEnum;
  buildium_property_id: string; // Form field as string
  rental_sub_type: RentalSubTypeEnum;
  rental_owner_ids: string; // Form field as comma-separated string
  operating_bank_account_id: string; // Form field as string
  reserve: string; // Form field as string
  year_built: string; // Form field as string
}

// Constants for form validation
export const PROPERTY_CONSTRAINTS = {
  name: {
    maxLength: 127,
    required: true
  },
  address_line1: {
    maxLength: 100,
    required: true
  },
  address_line2: {
    maxLength: 100
  },
  address_line3: {
    maxLength: 100
  },
  city: {
    maxLength: 100
  },
  state: {
    maxLength: 100
  },
  postal_code: {
    maxLength: 20,
    required: true
  },
  year_built: {
    min: 1000,
    max: new Date().getFullYear()
  },
  reserve: {
    min: 0,
    precision: 2
  }
} as const;
