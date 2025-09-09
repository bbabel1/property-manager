import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert";
import {
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Table as TableIcon,
  Users,
  Building,
  FileText,
  Link2,
  Info,
  Eye,
  EyeOff
} from "lucide-react";
import { projectId } from "../utils/supabase/info";

interface TableInfo {
  table_name: string;
  columns: any[];
  row_count: number;
  sample_data: any[];
}

interface SchemaInfo {
  tables: TableInfo[];
  foreign_keys: any[];
  user_id: string;
  timestamp: string;
}

interface DataStatus {
  user_id: string;
  timestamp: string;
  tables: {
    [key: string]: {
      exists: boolean;
      count: number;
      hasUserData: boolean;
    };
  };
  realDataAvailable: boolean;
  mockDataDisabled: boolean;
}

interface Relationship {
  properties_to_owners: any[];
  properties_to_managers: any[];
  owners_to_contacts: any[];
  staff_to_users: any[];
  user_id: string;
  timestamp: string;
}

interface SchemaValidatorProps {
  accessToken: string;
}

export function SchemaValidator({ accessToken }: SchemaValidatorProps) {
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [relationships, setRelationships] = useState<Relationship | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showSampleData, setShowSampleData] = useState<{[key: string]: boolean}>({});
  
  const expectedSchema = {
    properties: [
      'id', 'name', 'address', 'city', 'state', 'type', 'rental_owner',
      'property_manager_id', 'manager_name', 'operating_account', 'deposit_account',
      'status', 'user_id', 'created_at'
    ],
    rental_owners: [
      'id', 'contact_id', 'is_company', 'user_id', 'created_at'
    ],
    contacts: [
      'id', 'first_name', 'last_name', 'email', 'phone_number', 'address',
      'company_name', 'user_id', 'created_at'
    ],
    property_owners: [
      'id', 'property_id', 'rental_owner_id', 'ownership_percent',
      'disbursement_percent', 'is_primary', 'created_at'
    ],
    staff: [
      'id', 'user_id', 'title', 'status', 'created_at'
    ],
    bank_accounts: [
      'id', 'name', 'account_type', 'user_id', 'created_at'
    ]
  };

  const fetchSchemaInfo = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Fetching database schema information...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/schema`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Schema information received:', data);
        setSchema(data.schema);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch schema:', errorText);
        setError(`Failed to fetch schema: ${response.status} - ${errorText}`);
      }
    } catch (err) {
      console.error('❌ Schema fetch error:', err);
      setError(`Network error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataStatus = async () => {
    try {
      console.log('📊 Fetching data status...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/data-status`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Data status received:', data);
        setDataStatus(data.dataStatus);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch data status:', errorText);
      }
    } catch (err) {
      console.error('❌ Data status fetch error:', err);
    }
  };

  const fetchRelationships = async () => {
    try {
      console.log('🔗 Fetching data relationships...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/schema/relationships`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Relationships received:', data);
        setRelationships(data.relationships);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch relationships:', errorText);
      }
    } catch (err) {
      console.error('❌ Relationships fetch error:', err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      fetchSchemaInfo(),
      fetchDataStatus(),
      fetchRelationships()
    ]);
  };

  useEffect(() => {
    if (accessToken) {
      refreshAll();
    }
  }, [accessToken]);

  const toggleSampleData = (tableName: string) => {
    setShowSampleData(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const getTableStatus = (tableName: string) => {
    const table = schema?.tables?.find(t => t.table_name === tableName);
    const status = dataStatus?.tables?.[tableName];
    
    if (!table && !status?.exists) {
      return { status: 'missing', color: 'destructive' };
    }
    
    if (status?.hasUserData) {
      return { status: 'has_data', color: 'default' };
    }
    
    if (status?.exists) {
      return { status: 'empty', color: 'secondary' };
    }
    
    return { status: 'unknown', color: 'outline' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'has_data':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'empty':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'missing':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string, count?: number) => {
    switch (status) {
      case 'has_data':
        return `${count || 0} records`;
      case 'empty':
        return 'Table exists, no data';
      case 'missing':
        return 'Table not found';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Schema Validator
          </h1>
          <p className="text-muted-foreground">
            Verify your Supabase database structure and data mapping
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyzing...' : 'Refresh Analysis'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Schema Analysis Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Data Source Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Data Source Configuration
          </CardTitle>
          <CardDescription>
            Current system configuration and data source verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Mock Data</label>
              <div className="mt-1">
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  Disabled
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Data Source</label>
              <div className="mt-1">
                <Badge variant="default">
                  <Database className="w-3 h-3 mr-1" />
                  Supabase Only
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">User ID</label>
              <p className="text-sm mt-1 font-mono">{dataStatus?.user_id || 'Loading...'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm mt-1">
                {dataStatus?.timestamp ? new Date(dataStatus.timestamp).toLocaleString() : 'Loading...'}
              </p>
            </div>
          </div>
          
          {dataStatus && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {dataStatus.realDataAvailable ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                )}
                <span className="font-medium">
                  {dataStatus.realDataAvailable 
                    ? 'Real data available in your database' 
                    : 'No user data found in database tables'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {dataStatus.realDataAvailable
                  ? 'Your application is connected to real Supabase data with no mock fallbacks.'
                  : 'Your database tables exist but contain no data for your user account. Add data through the UI or directly in Supabase.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Schema Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="w-5 h-5" />
            Table Schema Validation
          </CardTitle>
          <CardDescription>
            Verify that your database tables match the expected structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(expectedSchema).map(([tableName, expectedColumns]) => {
              const table = schema?.tables?.find(t => t.table_name === tableName);
              const { status, color } = getTableStatus(tableName);
              const statusData = dataStatus?.tables?.[tableName];
              
              return (
                <Collapsible key={tableName}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <div>
                          <div className="font-medium">{tableName}</div>
                          <div className="text-sm text-muted-foreground">
                            {getStatusText(status, statusData?.count)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={color as any}>
                          {status === 'has_data' ? 'Active' : 
                           status === 'empty' ? 'Empty' : 
                           status === 'missing' ? 'Missing' : 'Unknown'}
                        </Badge>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 border-l-2 border-muted space-y-4">
                      {/* Expected vs Actual Columns */}
                      <div>
                        <h4 className="font-medium mb-2">Column Structure</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Expected Columns</label>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {expectedColumns.map(col => (
                                <Badge key={col} variant="outline" className="text-xs">
                                  {col}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Actual Columns</label>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {table?.sample_data?.[0] ? Object.keys(table.sample_data[0]).map(col => (
                                <Badge 
                                  key={col} 
                                  variant={expectedColumns.includes(col) ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {col}
                                </Badge>
                              )) : (
                                <span className="text-xs text-muted-foreground">No data to analyze</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Sample Data */}
                      {table?.sample_data && table.sample_data.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Sample Data</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSampleData(tableName)}
                            >
                              {showSampleData[tableName] ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-1" />
                                  Show
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {showSampleData[tableName] && (
                            <div className="mt-2 overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {Object.keys(table.sample_data[0]).map(col => (
                                      <TableHead key={col} className="text-xs">
                                        {col}
                                      </TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {table.sample_data.slice(0, 3).map((row, index) => (
                                    <TableRow key={index}>
                                      {Object.entries(row).map(([col, value]) => (
                                        <TableCell key={col} className="text-xs max-w-32 truncate">
                                          {value !== null && value !== undefined ? String(value) : '-'}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Data Relationships */}
      {relationships && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Data Relationships
            </CardTitle>
            <CardDescription>
              Foreign key relationships and data connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Properties → Owners
                </h4>
                <div className="text-sm">
                  {relationships.properties_to_owners?.length || 0} ownership records
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Owners → Contacts
                </h4>
                <div className="text-sm">
                  {relationships.owners_to_contacts?.length || 0} contact records
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Properties → Managers
                </h4>
                <div className="text-sm">
                  {relationships.properties_to_managers?.length || 0} manager assignments
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Staff → Users
                </h4>
                <div className="text-sm">
                  {relationships.staff_to_users?.length || 0} staff records
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Frontend Component Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Frontend Component Mapping
          </CardTitle>
          <CardDescription>
            How database tables map to frontend components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-md">
                <h4 className="font-medium mb-2">Properties Component</h4>
                <div className="text-sm space-y-1">
                  <div>• <code>properties</code> → Property list</div>
                  <div>• <code>property_owners</code> → Ownership data</div>
                  <div>• <code>staff</code> → Property managers</div>
                  <div>• <code>bank_accounts</code> → Account selection</div>
                </div>
              </div>
              
              <div className="p-3 border rounded-md">
                <h4 className="font-medium mb-2">OwnerSearch Component</h4>
                <div className="text-sm space-y-1">
                  <div>• <code>rental_owners</code> → Owner list</div>
                  <div>• <code>contacts</code> → Contact details</div>
                  <div>• <code>property_owners</code> → Ownership percentages</div>
                </div>
              </div>
              
              <div className="p-3 border rounded-md">
                <h4 className="font-medium mb-2">PropertyManagerSearch</h4>
                <div className="text-sm space-y-1">
                  <div>• <code>staff</code> → Staff list</div>
                  <div>• <code>users</code> → User details</div>
                  <div>• <code>contacts</code> → Contact info</div>
                </div>
              </div>
              
              <div className="p-3 border rounded-md">
                <h4 className="font-medium mb-2">Tenants Component</h4>
                <div className="text-sm space-y-1">
                  <div>• <code>tenants</code> → Tenant list</div>
                  <div>• <code>leases</code> → Lease details</div>
                  <div>• <code>properties</code> → Property refs</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}