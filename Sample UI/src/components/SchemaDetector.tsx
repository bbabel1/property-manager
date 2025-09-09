import { useState } from "react";
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
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Eye,
  Copy
} from "lucide-react";
import { projectId } from "../utils/supabase/info";

interface TableSchema {
  exists: boolean;
  columns: string[];
  sampleData?: any;
  note?: string;
  error?: string;
  code?: string;
}

interface SchemaDetection {
  schemas: {
    [tableName: string]: TableSchema;
  };
  user_id: string;
  timestamp: string;
}

interface SchemaDetectorProps {
  accessToken: string;
}

export function SchemaDetector({ accessToken }: SchemaDetectorProps) {
  const [detection, setDetection] = useState<SchemaDetection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showSampleData, setShowSampleData] = useState<{[key: string]: boolean}>({});

  const detectColumns = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Detecting database column structure...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/schema/detect-columns`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Schema detection complete:', data);
        setDetection(data);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to detect schema:', errorText);
        setError(`Failed to detect schema: ${response.status} - ${errorText}`);
      }
    } catch (err) {
      console.error('❌ Schema detection error:', err);
      setError(`Network error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const toggleSampleData = (tableName: string) => {
    setShowSampleData(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const getTableStatus = (schema: TableSchema) => {
    if (!schema.exists) {
      return { icon: <XCircle className="w-4 h-4 text-red-600" />, color: 'destructive' };
    }
    if (schema.columns && schema.columns.length > 0) {
      return { icon: <CheckCircle className="w-4 h-4 text-green-600" />, color: 'default' };
    }
    return { icon: <AlertCircle className="w-4 h-4 text-yellow-600" />, color: 'secondary' };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Schema Detector
          </h1>
          <p className="text-muted-foreground">
            Detect the actual column structure of your Supabase tables
          </p>
        </div>
        <Button onClick={detectColumns} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Detecting...' : 'Detect Schema'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Detection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {detection && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Detection Results</CardTitle>
              <CardDescription>
                Schema detection completed at {new Date(detection.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <strong>User ID:</strong> <code>{detection.user_id}</code>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {Object.entries(detection.schemas).map(([tableName, schema]) => {
              const { icon, color } = getTableStatus(schema);
              
              return (
                <Card key={tableName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {icon}
                      <span>{tableName}</span>
                      <Badge variant={color as any}>
                        {schema.exists ? 
                          (schema.columns && schema.columns.length > 0 ? 
                            `${schema.columns.length} columns` : 'Empty') : 
                          'Missing'}
                      </Badge>
                    </CardTitle>
                    {schema.note && (
                      <CardDescription>{schema.note}</CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {schema.error ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          {schema.error} {schema.code && `(Code: ${schema.code})`}
                        </AlertDescription>
                      </Alert>
                    ) : schema.columns && schema.columns.length > 0 ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">Columns</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(schema.columns.join(', '))}
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {schema.columns.map(column => (
                              <Badge key={column} variant="outline" className="font-mono">
                                {column}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        {schema.sampleData && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">Sample Data</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSampleData(tableName)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                {showSampleData[tableName] ? 'Hide' : 'Show'}
                              </Button>
                            </div>
                            
                            {showSampleData[tableName] && (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      {schema.columns.map(column => (
                                        <TableHead key={column} className="text-xs font-mono">
                                          {column}
                                        </TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow>
                                      {schema.columns.map(column => (
                                        <TableCell key={column} className="text-xs max-w-32 truncate font-mono">
                                          {schema.sampleData[column] !== null && 
                                           schema.sampleData[column] !== undefined 
                                            ? String(schema.sampleData[column])
                                            : '-'}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : schema.exists ? (
                      <div className="text-sm text-muted-foreground italic">
                        Table exists but contains no data to analyze
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {!detection && !loading && (
        <Card>
          <CardContent className="text-center p-8">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Ready to Detect Schema</h3>
            <p className="text-muted-foreground mb-4">
              Click "Detect Schema" to analyze your database table structure and identify column names.
            </p>
            <Button onClick={detectColumns}>
              <Database className="w-4 h-4 mr-2" />
              Start Detection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}