'use client'

import { useSdk } from '@/contexts/sdk-context'
import { useEffect, useState } from 'react'
import { wasmSdkService } from '@/lib/services/wasm-sdk-service'

export default function TestSdkPage() {
  const { isReady, error } = useSdk()
  const [testResult, setTestResult] = useState<string>('')
  
  useEffect(() => {
    const testSdk = async () => {
      try {
        console.log('Test SDK Page: Starting test...')
        const sdk = await wasmSdkService.getSdk()
        console.log('Test SDK Page: Got SDK instance:', sdk)
        setTestResult('SDK is working!')
      } catch (err) {
        console.error('Test SDK Page: Error:', err)
        setTestResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    
    if (isReady) {
      testSdk()
    }
  }, [isReady])
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">SDK Test Page</h1>
      <div className="space-y-2">
        <p>SDK Ready: {isReady ? 'Yes' : 'No'}</p>
        <p>SDK Error: {error || 'None'}</p>
        <p>Test Result: {testResult || 'Waiting...'}</p>
      </div>
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-sm">Check browser console for detailed logs</p>
      </div>
    </div>
  )
}