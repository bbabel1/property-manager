import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { RefreshCw, Database, AlertCircle, CheckCircle } from "lucide-react";
import { projectId } from "../utils/supabase/info";

interface RentalOwnersDebugProps {
  accessToken?: string;
}

export function RentalOwnersDebug({ accessToken }: RentalOwnersDebugProps) {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [schemaData, setSchemaData] = useState<any>(null);

  const runSchemaDebug = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      console.log("🔍 Running schema debug...");
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/debug/rental-owners`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Debug data received:", data);
        setDebugData(data);
      } else {
        const errorText = await response.text();
        console.error("❌ Debug failed:", errorText);
        setDebugData({ error: errorText });
      }
    } catch (error) {
      console.error("❌ Debug error:", error);
      setDebugData({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const runSchemaDetection = async () => {
    if (!accessToken) return;
    
    try {
      console.log("🔍 Running schema detection...");
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
        console.log("✅ Schema data received:", data);
        setSchemaData(data);
      } else {
        const errorText = await response.text();
        console.error("❌ Schema detection failed:", errorText);
        setSchemaData({ error: errorText });
      }
    } catch (error) {
      console.error("❌ Schema detection error:", error);
      setSchemaData({ error: error.message });
    }
  };

  const testRentalOwnersAPI = async () => {
    if (!accessToken) return;
    
    try {
      console.log("🔍 Testing rental owners API...");
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners/search`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("📋 Response status:", response.status);
      console.log("📋 Response headers:", Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log("📋 Raw response:", responseText);

      try {
        const data = JSON.parse(responseText);
        console.log("✅ Parsed API data:", data);
        
        if (data.owners && data.owners.length > 0) {
          console.log("📋 Sample owner data:", data.owners[0]);
          console.log("📋 First owner contact details:", {
            id: data.owners[0].id,
            firstName: data.owners[0].firstName,
            lastName: data.owners[0].lastName,
            fullName: data.owners[0].fullName,
            email: data.owners[0].email,
            contactId: data.owners[0].contactId,
            contactData: data.owners[0].contactData
          });
        }
      } catch (parseError) {
        console.error("❌ Failed to parse JSON:", parseError);
      }
    } catch (error) {
      console.error("❌ API test error:", error);
    }
  };

  useEffect(() => {
    if (accessToken) {
      runSchemaDetection();
    }
  }, [accessToken]);

  if (!accessToken) {
    return (
      <div className="p-6">
        <h1>Rental Owners Debug</h1>
        <p className="text-muted-foreground">Please sign in to access the debug tools</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1>Rental Owners Debug</h1>
        <p className="text-muted-foreground">
          Debug tools to understand why contact names aren't populating
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={runSchemaDebug} disabled={loading}>
          {loading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Database className="w-4 h-4 mr-2" />
          )}
          Debug Rental Owners Queries
        </Button>
        
        <Button onClick={runSchemaDetection} variant="outline">
          <Database className="w-4 h-4 mr-2" />
          Detect Schema
        </Button>
        
        <Button onClick={testRentalOwnersAPI} variant="outline">
          <AlertCircle className="w-4 h-4 mr-2" />
          Test API
        </Button>
      </div>

      {/* Schema Detection Results */}
      {schemaData && (
        <Card>
          <CardHeader>
            <CardTitle>Database Schema Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {schemaData.error ? (
                <div className="text-red-600">Error: {schemaData.error}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contacts Table */}
                    <div className="p-4 border rounded">
                      <h4 className="font-medium mb-2">Contacts Table</h4>
                      {schemaData.schemas?.contacts ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={schemaData.schemas.contacts.exists ? "default" : "destructive"}>
                              {schemaData.schemas.contacts.exists ? "Exists" : "Missing"}
                            </Badge>
                            {schemaData.schemas.contacts.hasData && (
                              <Badge variant="secondary">
                                {schemaData.schemas.contacts.rowCount} rows
                              </Badge>
                            )}
                          </div>
                          
                          {schemaData.schemas.contacts.columns && (
                            <div>
                              <p className="text-sm font-medium">Columns:</p>
                              <p className="text-xs text-muted-foreground">
                                {schemaData.schemas.contacts.columns.join(", ")}
                              </p>
                            </div>
                          )}
                          
                          {schemaData.schemas.contacts.sampleData && (
                            <div>
                              <p className="text-sm font-medium">Sample Data:</p>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                {JSON.stringify(schemaData.schemas.contacts.sampleData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No data available</p>
                      )}
                    </div>

                    {/* Rental Owners Table */}
                    <div className="p-4 border rounded">
                      <h4 className="font-medium mb-2">Rental Owners Table</h4>
                      {schemaData.schemas?.rental_owners ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={schemaData.schemas.rental_owners.exists ? "default" : "destructive"}>
                              {schemaData.schemas.rental_owners.exists ? "Exists" : "Missing"}
                            </Badge>
                            {schemaData.schemas.rental_owners.hasData && (
                              <Badge variant="secondary">
                                {schemaData.schemas.rental_owners.rowCount} rows
                              </Badge>
                            )}
                            {schemaData.schemas.rental_owners.hasContactId && (
                              <Badge variant="default">Has contact_id</Badge>
                            )}
                          </div>
                          
                          {schemaData.schemas.rental_owners.columns && (
                            <div>
                              <p className="text-sm font-medium">Columns:</p>
                              <p className="text-xs text-muted-foreground">
                                {schemaData.schemas.rental_owners.columns.join(", ")}
                              </p>
                            </div>
                          )}
                          
                          {schemaData.schemas.rental_owners.sampleData && (
                            <div>
                              <p className="text-sm font-medium">Sample Data:</p>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                {JSON.stringify(schemaData.schemas.rental_owners.sampleData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No data available</p>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {schemaData.summary && (
                    <div className="p-4 bg-muted rounded">
                      <h4 className="font-medium mb-2">Analysis Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Recommended Strategy:</span>
                          <span className="ml-2">{schemaData.summary.recommendedStrategy}</span>
                        </div>
                        <div>
                          <span className="font-medium">Contact Integration Possible:</span>
                          <span className="ml-2">
                            {schemaData.summary.contactIntegrationPossible ? "✅ Yes" : "❌ No"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Tables with Data:</span>
                          <span className="ml-2">{schemaData.summary.tablesWithData}</span>
                        </div>
                        <div>
                          <span className="font-medium">Existing Tables:</span>
                          <span className="ml-2">{schemaData.summary.existingTables}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Query Results */}
      {debugData && (
        <Card>
          <CardHeader>
            <CardTitle>Rental Owners Query Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {debugData.error ? (
                <div className="text-red-600">Error: {debugData.error}</div>
              ) : (
                <>
                  {/* Steps */}
                  {debugData.steps && (
                    <div>
                      <h4 className="font-medium mb-2">Debug Steps</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {debugData.steps.map((step: string, index: number) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Queries */}
                  {debugData.queries && (
                    <div>
                      <h4 className="font-medium mb-2">Database Queries</h4>
                      <div className="space-y-2">
                        {debugData.queries.map((query: any, index: number) => (
                          <div key={index} className="p-3 border rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{query.table}</span>
                              <Badge variant={query.success ? "default" : "destructive"}>
                                {query.success ? "Success" : "Failed"}
                              </Badge>
                              {query.rowCount !== undefined && (
                                <Badge variant="secondary">{query.rowCount} rows</Badge>
                              )}
                            </div>
                            {query.error && (
                              <p className="text-sm text-red-600 mb-2">Error: {query.error}</p>
                            )}
                            {query.sampleData && (
                              <div>
                                <p className="text-sm font-medium">Sample Data:</p>
                                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                  {JSON.stringify(query.sampleData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  {debugData.results && (
                    <div>
                      <h4 className="font-medium mb-2">Query Results</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(debugData.results).map(([key, result]: [string, any]) => (
                          <div key={key} className="p-3 border rounded">
                            <h5 className="font-medium capitalize mb-2">{key.replace('_', ' ')}</h5>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={result.exists ? "default" : "destructive"}>
                                  {result.exists ? "Exists" : "Missing"}
                                </Badge>
                                {result.count !== undefined && (
                                  <Badge variant="secondary">{result.count} records</Badge>
                                )}
                              </div>
                              
                              {result.columns && (
                                <div>
                                  <p className="text-sm font-medium">Columns:</p>
                                  <p className="text-xs text-muted-foreground">
                                    {result.columns.join(", ")}
                                  </p>
                                </div>
                              )}
                              
                              {result.sampleRecord && (
                                <div>
                                  <p className="text-sm font-medium">Sample Record:</p>
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                                    {JSON.stringify(result.sampleRecord, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analysis */}
                  {debugData.analysis && (
                    <div className="p-4 bg-muted rounded">
                      <h4 className="font-medium mb-2">Debug Analysis</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Recommended Approach:</span>
                          <span className="ml-2">{debugData.analysis.recommendedApproach}</span>
                        </div>
                        <div>
                          <span className="font-medium">Contact Integration:</span>
                          <span className="ml-2">
                            {debugData.analysis.canUseContactIntegration ? "✅ Available" : "❌ Not Available"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Contacts as Owners:</span>
                          <span className="ml-2">
                            {debugData.analysis.canUseContactsAsOwners ? "✅ Available" : "❌ Not Available"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Has Any Data:</span>
                          <span className="ml-2">
                            {debugData.analysis.hasAnyData ? "✅ Yes" : "❌ No"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {debugData.errors && debugData.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Errors Encountered</h4>
                      <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                        {debugData.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}