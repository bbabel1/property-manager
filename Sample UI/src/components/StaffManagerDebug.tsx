import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { RefreshCw, Database, AlertTriangle, CheckCircle } from "lucide-react";

interface StaffManagerDebugProps {
  accessToken: string | null;
}

export function StaffManagerDebug({ accessToken }: StaffManagerDebugProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const testStaffEndpoint = async () => {
    if (!accessToken) {
      setError('No access token available');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('🧪 Testing staff managers endpoint...');
      console.log('📡 Endpoint:', `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/staff/managers`);
      console.log('🔑 Access token length:', accessToken.length);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/staff/managers`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('📡 Response data:', data);

      if (response.ok) {
        setResult({
          success: true,
          status: response.status,
          data: data,
          rawResponse: JSON.stringify(data, null, 2)
        });
      } else {
        setError(`HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`);
        setResult({
          success: false,
          status: response.status,
          data: data,
          rawResponse: JSON.stringify(data, null, 2)
        });
      }
    } catch (err) {
      console.error('❌ Staff endpoint test error:', err);
      setError(`Network error: ${err.message}`);
      setResult({
        success: false,
        status: 0,
        error: err.message,
        rawResponse: err.toString()
      });
    } finally {
      setLoading(false);
    }
  };

  const testSchemaAnalysis = async () => {
    if (!accessToken) {
      setError('No access token available');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('🧪 Testing schema analysis endpoint...');
      console.log('📡 Endpoint:', `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/debug/schema-analysis`);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/debug/schema-analysis`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 Schema analysis response status:', response.status);

      const data = await response.json();
      console.log('📡 Schema analysis response data:', data);

      if (response.ok) {
        setResult({
          success: true,
          status: response.status,
          data: data,
          rawResponse: JSON.stringify(data, null, 2),
          type: 'schema'
        });
      } else {
        setError(`HTTP ${response.status}: ${data.error || data.message || 'Unknown error'}`);
        setResult({
          success: false,
          status: response.status,
          data: data,
          rawResponse: JSON.stringify(data, null, 2),
          type: 'schema'
        });
      }
    } catch (err) {
      console.error('❌ Schema analysis test error:', err);
      setError(`Network error: ${err.message}`);
      setResult({
        success: false,
        status: 0,
        error: err.message,
        rawResponse: err.toString(),
        type: 'schema'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Staff Manager Endpoint Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button 
              onClick={testStaffEndpoint} 
              disabled={loading || !accessToken}
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Test Staff Managers Endpoint
            </Button>

            <Button 
              onClick={testSchemaAnalysis} 
              disabled={loading || !accessToken}
              variant="outline"
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              Test Schema Analysis
            </Button>
          </div>

          {!accessToken && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">No access token available. Please sign in first.</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                result.success 
                  ? 'text-green-600 bg-green-50' 
                  : 'text-red-600 bg-red-50'
              }`}>
                {result.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {result.success 
                    ? `Success! HTTP ${result.status}` 
                    : `Failed! HTTP ${result.status}`
                  }
                </span>
              </div>

              {result.data && (
                <div className="space-y-3">
                  <h4 className="font-medium">Response Summary:</h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Source:</span> {result.data.source || 'unknown'}
                    </div>
                    <div>
                      <span className="font-medium">Count:</span> {result.data.count || 0}
                    </div>
                    <div>
                      <span className="font-medium">Managers Found:</span> {result.data.managers?.length || 0}
                    </div>
                    <div>
                      <span className="font-medium">Message:</span> {result.data.message || 'None'}
                    </div>
                  </div>

                  {result.data.debugInfo && (
                    <div className="space-y-2">
                      <h5 className="font-medium">Tables Found:</h5>
                      <div className="text-sm space-y-1">
                        {Object.entries(result.data.debugInfo).map(([tableName, info]: [string, any]) => (
                          <div key={tableName} className="flex justify-between">
                            <span>{tableName}:</span>
                            <span className={info.exists ? 'text-green-600' : 'text-red-600'}>
                              {info.exists ? `✅ ${info.rowCount} rows` : '❌ Not found'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.data.managers && result.data.managers.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium">Managers Data:</h5>
                      <div className="text-sm space-y-2">
                        {result.data.managers.map((manager: any, index: number) => (
                          <div key={index} className="border rounded p-2 bg-gray-50">
                            <div><strong>Name:</strong> {manager.fullName}</div>
                            <div><strong>Email:</strong> {manager.email}</div>
                            <div><strong>Title:</strong> {manager.title}</div>
                            <div><strong>ID:</strong> {manager.id}</div>
                            <div><strong>Staff ID:</strong> {manager.staffId}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.data.suggestions && result.data.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium">Suggestions:</h5>
                      <ul className="text-sm space-y-1">
                        {result.data.suggestions.map((suggestion: string, index: number) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-sm">Raw Response Data</summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64">
                  {result.rawResponse}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}