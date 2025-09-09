export default function TestPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>
      <p className="text-green-600">This is a test page to check if routing works.</p>
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h2 className="font-semibold text-yellow-800">Test Content</h2>
        <p className="text-yellow-700">If you can see this, the routing is working correctly.</p>
      </div>
    </div>
  )
}
