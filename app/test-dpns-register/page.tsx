'use client';

import { useState } from 'react';
import { dpnsService } from '@/lib/services/dpns-service';
import { identityService } from '@/lib/services/identity-service';

export default function TestDpnsRegister() {
  const [username, setUsername] = useState('');
  const [identityId, setIdentityId] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [keyId, setKeyId] = useState('0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [validation, setValidation] = useState<any>(null);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (value) {
      const validationResult = dpnsService.validateUsername(value);
      setValidation(validationResult);
    } else {
      setValidation(null);
    }
  };

  const handleRegister = async () => {
    if (!username || !identityId || !privateKey) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress('Starting registration...');

    try {
      // Callback for preorder success
      const onPreorderSuccess = () => {
        setProgress('Preorder successful! Submitting domain document...');
      };

      const registrationResult = await dpnsService.registerUsername(
        username,
        identityId,
        parseInt(keyId),
        privateKey,
        onPreorderSuccess
      );

      setProgress('Registration complete!');
      setResult(registrationResult);
    } catch (err: any) {
      setError(err.message || 'Failed to register username');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isAvailable = await dpnsService.isUsernameAvailable(username);
      setResult({ available: isAvailable });
    } catch (err: any) {
      setError(err.message || 'Failed to check availability');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolved = await dpnsService.resolveIdentity(username);
      setResult({ identityId: resolved });
    } catch (err: any) {
      setError(err.message || 'Failed to resolve username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">DPNS Registration Test</h1>

        {/* Username Input with Validation */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Username (without .dash)
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none"
            placeholder="e.g., alice"
          />
          
          {validation && (
            <div className="mt-2 space-y-1 text-sm">
              <div className={validation.isValid ? 'text-green-400' : 'text-red-400'}>
                {validation.isValid ? '✓ Valid username format' : '✗ Invalid username format'}
              </div>
              {validation.isContested && (
                <div className="text-yellow-400">
                  ⚠️ This is a contested username (requires masternode voting)
                </div>
              )}
              <div className="text-gray-400">
                Normalized: {validation.normalizedLabel}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={handleCheckAvailability}
            disabled={loading || !username}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded transition-colors"
          >
            Check Availability
          </button>
          <button
            onClick={handleResolve}
            disabled={loading || !username}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded transition-colors"
          >
            Resolve Username
          </button>
        </div>

        <hr className="border-gray-700 my-6" />

        {/* Registration Form */}
        <h2 className="text-xl font-bold mb-4">Register Username</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Identity ID
            </label>
            <input
              type="text"
              value={identityId}
              onChange={(e) => setIdentityId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none"
              placeholder="Your identity ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Private Key (WIF)
            </label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none"
              placeholder="Your private key in WIF format"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Key ID (optional, 0 for auto-select)
            </label>
            <input
              type="number"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:border-blue-500 focus:outline-none"
              placeholder="0"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || !validation?.isValid}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded transition-colors font-medium"
          >
            {loading ? 'Processing...' : 'Register Username'}
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div className="mt-6 p-4 bg-blue-900/50 rounded">
            <div className="text-sm text-blue-300">{progress}</div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-900/50 rounded">
            <pre className="text-sm text-red-300">{error}</pre>
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="mt-6 p-4 bg-gray-900 rounded">
            <h3 className="text-lg font-medium mb-2">Result:</h3>
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-gray-900 rounded">
          <h3 className="text-lg font-medium mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>Enter a username to see validation in real-time</li>
            <li>Use &quot;Check Availability&quot; to see if a username is taken</li>
            <li>Use &quot;Resolve Username&quot; to find the identity ID for a username</li>
            <li>To register a username, you need:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>A valid, available username</li>
                <li>Your identity ID</li>
                <li>Your private key in WIF format</li>
                <li>Optionally, a specific key ID (0 for auto-select)</li>
              </ul>
            </li>
            <li>The registration process has two steps:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Preorder document submission</li>
                <li>Domain document submission</li>
              </ul>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}