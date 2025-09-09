import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { RefreshCw, Database } from "lucide-react";
import { supabase } from "../utils/supabase/client";

interface ContactDataTestProps {
  accessToken?: string;
}

export function ContactDataTest({ accessToken }: ContactDataTestProps) {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDirectDatabaseTest = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Direct contacts query
      console.log("🔍 Test 1: Direct contacts query...");
      try {
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .limit(10);
        
        results.tests.push({
          name: "Direct Contacts Query",
          success: !contactsError,
          error: contactsError?.message,
          count: contacts?.length || 0,
          sampleData: contacts?.[0] || null,
          allData: contacts || []
        });
        
        console.log("✅ Contacts test result:", { success: !contactsError, count: contacts?.length });
      } catch (err) {
        results.tests.push({
          name: "Direct Contacts Query",
          success: false,
          error: err.message,
          count: 0,
          sampleData: null
        });
      }

      // Test 2: Direct rental_owners query
      console.log("🔍 Test 2: Direct rental_owners query...");
      try {
        const { data: owners, error: ownersError } = await supabase
          .from('rental_owners')
          .select('*')
          .limit(10);
        
        results.tests.push({
          name: "Direct Rental Owners Query",
          success: !ownersError,
          error: ownersError?.message,
          count: owners?.length || 0,
          sampleData: owners?.[0] || null,
          allData: owners || []
        });
        
        console.log("✅ Rental owners test result:", { success: !ownersError, count: owners?.length });
      } catch (err) {
        results.tests.push({
          name: "Direct Rental Owners Query",
          success: false,
          error: err.message,
          count: 0,
          sampleData: null
        });
      }

      // Test 3: Manual JOIN query (if both tables have data)
      const contactsTest = results.tests.find(t => t.name === "Direct Contacts Query");
      const ownersTest = results.tests.find(t => t.name === "Direct Rental Owners Query");
      
      if (contactsTest?.success && ownersTest?.success && ownersTest.count > 0) {
        console.log("🔍 Test 3: Manual JOIN simulation...");
        try {
          // Get all rental owners
          const { data: allOwners, error: allOwnersError } = await supabase
            .from('rental_owners')
            .select('*');
          
          if (!allOwnersError && allOwners) {
            // Get contact IDs from rental owners
            const contactIds = allOwners
              .map(owner => owner.contact_id)
              .filter(id => id != null);
            
            console.log("📋 Contact IDs from rental owners:", contactIds);
            
            if (contactIds.length > 0) {
              // Fetch contacts for those IDs
              const { data: relatedContacts, error: relatedContactsError } = await supabase
                .from('contacts')
                .select('*')
                .in('id', contactIds);
              
              console.log("📋 Related contacts found:", relatedContacts?.length);
              
              // Combine the data manually
              const combinedData = allOwners.map(owner => {
                const contact = relatedContacts?.find(c => c.id === owner.contact_id);
                return {
                  ...owner,
                  contact_data: contact || null,
                  has_contact: !!contact,
                  contact_name: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : null
                };
              });
              
              results.tests.push({
                name: "Manual JOIN Simulation",
                success: !relatedContactsError,
                error: relatedContactsError?.message,
                count: combinedData.length,
                sampleData: combinedData[0] || null,
                allData: combinedData,
                contactIds: contactIds,
                contactsFound: relatedContacts?.length || 0
              });
              
              console.log("✅ Manual JOIN result:", { 
                success: !relatedContactsError, 
                ownersCount: allOwners.length,
                contactIdsCount: contactIds.length,
                contactsFoundCount: relatedContacts?.length || 0
              });
            } else {
              results.tests.push({
                name: "Manual JOIN Simulation",
                success: false,
                error: "No valid contact_id values found in rental_owners",
                count: 0,
                sampleData: null
              });
            }
          }
        } catch (err) {
          results.tests.push({
            name: "Manual JOIN Simulation",
            success: false,
            error: err.message,
            count: 0,
            sampleData: null
          });
        }
      } else {
        results.tests.push({
          name: "Manual JOIN Simulation",
          success: false,
          error: "Skipped - prerequisite tables not available or empty",
          count: 0,
          sampleData: null
        });
      }

      console.log("🎯 All tests completed:", results);
      setTestResults(results);
    } catch (error) {
      console.error("❌ Test suite failed:", error);
      setTestResults({
        timestamp: new Date().toISOString(),
        error: error.message,
        tests: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="p-6">
        <h1>Contact Data Test</h1>
        <p className="text-muted-foreground">Please sign in to run tests</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1>Contact Data Test</h1>
        <p className="text-muted-foreground">
          Direct database test to see what's happening with contact data
        </p>
      </div>

      <Button onClick={runDirectDatabaseTest} disabled={loading}>
        {loading ? (
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Database className="w-4 h-4 mr-2" />
        )}
        Run Direct Database Test
      </Button>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle>Direct Database Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {testResults.error ? (
                <div className="text-red-600">Test Suite Error: {testResults.error}</div>
              ) : (
                testResults.tests.map((test: any, index: number) => (
                  <div key={index} className="p-4 border rounded">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-medium">{test.name}</h4>
                      <Badge variant={test.success ? "default" : "destructive"}>
                        {test.success ? "Success" : "Failed"}
                      </Badge>
                      {test.count !== undefined && (
                        <Badge variant="secondary">{test.count} records</Badge>
                      )}
                    </div>

                    {test.error && (
                      <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                        Error: {test.error}
                      </div>
                    )}

                    {test.contactIds && (
                      <div className="mb-3">
                        <p className="text-sm font-medium">Contact IDs found in rental_owners:</p>
                        <p className="text-xs text-muted-foreground">
                          {test.contactIds.join(", ")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Contacts found: {test.contactsFound} / {test.contactIds.length}
                        </p>
                      </div>
                    )}

                    {test.sampleData && (
                      <div className="mb-3">
                        <p className="text-sm font-medium">Sample Record:</p>
                        <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-auto max-h-40">
                          {JSON.stringify(test.sampleData, null, 2)}
                        </pre>
                      </div>
                    )}

                    {test.allData && test.allData.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">All Records ({test.allData.length}):</p>
                        <div className="mt-2 space-y-2">
                          {test.allData.slice(0, 5).map((record: any, idx: number) => (
                            <div key={idx} className="p-2 bg-muted rounded text-xs">
                              <div className="font-medium">Record {idx + 1}:</div>
                              {record.contact_name && (
                                <div className="text-green-600">✅ Contact Name: {record.contact_name}</div>
                              )}
                              {record.first_name && (
                                <div>First Name: {record.first_name}</div>
                              )}
                              {record.last_name && (
                                <div>Last Name: {record.last_name}</div>
                              )}
                              {record.email && (
                                <div>Email: {record.email}</div>
                              )}
                              {record.contact_id && (
                                <div>Contact ID: {record.contact_id}</div>
                              )}
                              {record.has_contact !== undefined && (
                                <div>Has Contact Data: {record.has_contact ? "✅ Yes" : "❌ No"}</div>
                              )}
                            </div>
                          ))}
                          {test.allData.length > 5 && (
                            <div className="text-xs text-muted-foreground">
                              ... and {test.allData.length - 5} more records
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}