'use client';

import { Building, MapPin, Users, Home, Mail, Edit2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Body, Heading, Label } from '@/ui/typography';
import { Separator } from '@/components/ui/separator';

interface PropertyData {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode: string;
  country: string;
  propertyType?: string;
}

interface OwnerData {
  id: string;
  name: string;
  ownershipPercentage: number;
  primary: boolean;
}

interface SignerData {
  email: string;
  name?: string;
}

interface UnitData {
  id: string;
  unitNumber: string;
  unitBedrooms?: string | null;
  unitBathrooms?: string | null;
}

interface AgreementReviewPanelProps {
  property: PropertyData;
  owners: OwnerData[];
  signers: SignerData[];
  units: UnitData[];
  onEditStep: (step: number) => void;
  disabled?: boolean;
}

export default function AgreementReviewPanel({
  property,
  owners,
  signers,
  units,
  onEditStep,
  disabled = false,
}: AgreementReviewPanelProps) {
  const formatAddress = () => {
    const parts = [
      property.addressLine1,
      property.addressLine2,
      property.city,
      property.state,
      property.postalCode,
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div className="space-y-6">
      <div>
        <Heading as="h3" size="h3">
          Review & Send Agreement
        </Heading>
        <Body className="text-muted-foreground mt-1">
          Review the information below before sending the management agreement.
        </Body>
      </div>

      {/* Property Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="h-4 w-4" />
            Property Details
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(2)}
            disabled={disabled}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground text-xs">Property Name</Label>
              <Body className="font-medium">{property.name}</Body>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Property Type</Label>
              <Body className="font-medium">{property.propertyType || 'Not specified'}</Body>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Address</Label>
            <div className="flex items-start gap-2">
              <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              <Body className="font-medium">{formatAddress()}</Body>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Owners & Signers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Owners & Signers
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(3)}
            disabled={disabled}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owners */}
          <div>
            <Label className="text-muted-foreground text-xs">Owners ({owners.length})</Label>
            <div className="mt-2 space-y-2">
              {owners.map((owner) => (
                <div
                  key={owner.id}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="flex items-center gap-2">
                    <Body className="font-medium">{owner.name}</Body>
                    {owner.primary && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <Body className="text-muted-foreground text-sm">
                    {owner.ownershipPercentage}%
                  </Body>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Signers */}
          <div>
            <Label className="text-muted-foreground text-xs">
              Agreement Signers ({signers.length})
            </Label>
            <div className="mt-2 space-y-2">
              {signers.map((signer, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <Mail className="text-muted-foreground h-4 w-4" />
                  <div>
                    <Body className="font-medium">{signer.name || signer.email}</Body>
                    {signer.name && (
                      <Body className="text-muted-foreground text-sm">{signer.email}</Body>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Units */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4" />
            Units ({units.length})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditStep(4)}
            disabled={disabled}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {units.slice(0, 9).map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <Body className="font-medium">Unit {unit.unitNumber}</Body>
                {(unit.unitBedrooms || unit.unitBathrooms) && (
                  <Body className="text-muted-foreground text-sm">
                    {unit.unitBedrooms && `${unit.unitBedrooms} BR`}
                    {unit.unitBedrooms && unit.unitBathrooms && ' / '}
                    {unit.unitBathrooms && `${unit.unitBathrooms} BA`}
                  </Body>
                )}
              </div>
            ))}
            {units.length > 9 && (
              <div className="text-muted-foreground flex items-center justify-center rounded-md border p-2 text-sm">
                +{units.length - 9} more units
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-3 pt-6">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <Body className="font-medium text-green-800 dark:text-green-200">
              Ready to send agreement
            </Body>
            <Body className="text-sm text-green-700 dark:text-green-300">
              All required information has been collected. You can now send the management
              agreement to the signers.
            </Body>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
