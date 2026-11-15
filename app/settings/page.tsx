'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    UserIcon,
    KeyIcon,
    BellIcon,
    ShieldCheckIcon,
    PaintBrushIcon,
    InformationCircleIcon,
    ArrowPathIcon,
    ArrowLeftIcon,
    ChevronRightIcon,
    MoonIcon,
    SunIcon,
    ComputerDesktopIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { Button } from '@/components/ui/button'
import { withAuth, useAuth } from '@/contexts/auth-context'
import { useNetwork } from '@/contexts/network-context'
import { useTheme } from 'next-themes'
import {
    addSessionKey,
    removeSessionKey,
    listSessionKeys,
    type RegisteredKeyInfo,
    type SessionKeyEntry,
} from '@/lib/session-keys-store'
import * as Switch from '@radix-ui/react-switch'
// App version displayed on the About page — pulled from package.json so
// it always matches the release.
import packageJson from '../../package.json'
import * as RadioGroup from '@radix-ui/react-radio-group'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { showErrorToast } from '@/lib/toast-error'
import { cacheManager } from '@/lib/cache-manager'

type SettingsSection = 'main' | 'account' | 'keys' | 'notifications' | 'privacy' | 'appearance' | 'about'

const settingsSections = [
    { id: 'account', label: 'Account', icon: UserIcon, description: 'Manage your account details' },
    { id: 'keys', label: 'Keys', icon: KeyIcon, description: 'Add or remove the private keys this session holds' },
    { id: 'notifications', label: 'Notifications', icon: BellIcon, description: 'Control your notification preferences' },
    { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheckIcon, description: 'Manage your privacy settings' },
    { id: 'appearance', label: 'Appearance', icon: PaintBrushIcon, description: 'Customize how EvoNext looks' },
    { id: 'about', label: 'About', icon: InformationCircleIcon, description: 'Learn more about EvoNext' },
]

function SettingsPage() {
    const router = useRouter()
    const { user, logout } = useAuth()
    const { network } = useNetwork()
    const { theme, setTheme } = useTheme()
    const [activeSection, setActiveSection] = useState<SettingsSection>('main')

    /* F57b — the KEY MANAGER state (Settings → Keys). */
    const [keysData, setKeysData] = useState<{ registered: RegisteredKeyInfo[]; loaded: Map<number, SessionKeyEntry> } | null>(null)
    const [keysLoading, setKeysLoading] = useState(false)
    const [keyInput, setKeyInput] = useState('')
    const [keysSubmitting, setKeysSubmitting] = useState(false)

    const loadSessionKeys = useCallback(async () => {
        if (!user?.identityId) return
        setKeysLoading(true)
        try {
            const sdkNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
            const data = await listSessionKeys(sdkNetwork, user.identityId)
            setKeysData(data)
        } catch (e: any) {
            showErrorToast(e?.message || 'Failed to read the identity keys.')
        } finally {
            setKeysLoading(false)
        }
    }, [network, user?.identityId])

    /* Load when the Keys panel opens. */
    useEffect(() => {
        if (activeSection === 'keys') {
            void loadSessionKeys()
        }
    }, [activeSection, loadSessionKeys])

    const handleAddSessionKey = async () => {
        if (!user?.identityId || keysSubmitting) return
        setKeysSubmitting(true)
        try {
            const sdkNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
            const entry = await addSessionKey(sdkNetwork, user.identityId, keyInput)
            toast.success(`Key #${entry.keyId} added to this session.`)
            setKeyInput('')
            await loadSessionKeys()
        } catch (e: any) {
            showErrorToast(e?.message || 'Failed to add the key.')
        } finally {
            setKeysSubmitting(false)
        }
    }

    const handleRemoveSessionKey = async (keyId: number) => {
        if (!user?.identityId || keysSubmitting) return
        if (!confirm(`Remove key #${keyId} from this session? Sends/documents that need it will stop working until you add it back.`)) return
        setKeysSubmitting(true)
        try {
            const sdkNetwork = (network === 'mainnet' ? 'mainnet' : 'testnet') as 'mainnet' | 'testnet'
            await removeSessionKey(sdkNetwork, user.identityId, keyId)
            toast.success(`Key #${keyId} removed.`)
            await loadSessionKeys()
        } catch (e: any) {
            showErrorToast(e?.message || 'Failed to remove the key.')
        } finally {
            setKeysSubmitting(false)
        }
    }

    // Notification settings
    const [notificationSettings, setNotificationSettings] = useState({
        likes: true,
        remixes: true,
        replies: true,
        follows: true,
        mentions: true,
        messages: true,
    })

    // Privacy settings
    const [privacySettings, setPrivacySettings] = useState({
        publicProfile: true,
        showActivity: true,
        allowMessages: 'everyone', // 'everyone', 'followers', 'none'
    })

    const handleBack = () => {
        if (activeSection === 'main') {
            router.back()
        } else {
            setActiveSection('main')
        }
    }

    const handleDeleteAccount = () => {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            showErrorToast('Account deletion is not yet implemented')
        }
    }

    const renderMainSettings = () => (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {settingsSections.map((section) => (
                <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id as SettingsSection)}
                    className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors flex items-center gap-4"
                >
                    <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
                        <section.icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 text-left">
                        <p className="font-medium">{section.label}</p>
                        <p className="text-sm text-gray-500">{section.description}</p>
                    </div>

                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                </button>
            ))}
        </div>
    )

    const renderAccountSettings = () => (
        <div className="p-6 space-y-6">
            <div>
                <h3 className="font-semibold mb-4">Account Information</h3>

                <div className="space-y-4 bg-gray-50 dark:bg-gray-950 rounded-lg p-4">
                    <div>
                        <p className="text-sm text-gray-500">Identity ID</p>
                        <p className="font-mono text-sm">{user?.identityId}</p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Balance</p>

                        <p className="font-mono">
                            {(() => {
                                const balance = user?.balance || 0;
                                // Balance is in duffs, convert to DASH (1 DASH = 100,000,000 duffs)
                                const dashBalance = balance / 100000000;

                                return `${dashBalance.toFixed(8)} DASH`;
                            })()}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-gray-500">Account Created</p>
                        <p className="text-sm">January 2024</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-4">Account Actions</h3>

                <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start" asChild>
                        <Link href="/profile">
                            <UserIcon className="h-4 w-4 mr-2" />
                            Edit Profile
                        </Link>
                    </Button>

                    <Button variant="outline" className="w-full justify-start" onClick={logout}>
                        <KeyIcon className="h-4 w-4 mr-2" />
                        Log Out
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:border-red-300"
                        onClick={handleDeleteAccount}
                    >
                        <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                        Delete Account
                    </Button>
                </div>
            </div>
        </div>
    )

    const renderNotificationSettings = () => (
        <div className="p-6 space-y-6">
            <div>
                <h3 className="font-semibold mb-4">Push Notifications</h3>

                <div className="space-y-4">
                    {Object.entries(notificationSettings).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                            <div>
                                <p className="font-medium capitalize">{key}</p>

                                <p className="text-sm text-gray-500">
                                    {key === 'likes' && 'When someone likes your posts'}
                                    {key === 'remixes' && 'When someone remixes your content'}
                                    {key === 'replies' && 'When someone replies to you'}
                                    {key === 'follows' && 'When someone follows you'}
                                    {key === 'mentions' && 'When someone mentions you'}
                                    {key === 'messages' && 'When you receive new messages'}
                                </p>
                            </div>

                            <Switch.Root
                                checked={value}
                                onCheckedChange={(checked) =>
                                    setNotificationSettings(prev => ({ ...prev, [key]: checked }))
                                }
                                className={`w-11 h-6 rounded-full relative transition-colors ${
                                    value ? 'bg-evonext-500' : 'bg-gray-200 dark:bg-gray-800'
                                }`}
                            >
                                <Switch.Thumb className="block w-8 h-8 bg-white rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5" />
                            </Switch.Root>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const renderPrivacySettings = () => (
        <div className="p-6 space-y-6">
            <div>
                <h3 className="font-semibold mb-4">Privacy</h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Public Profile</p>
                            <p className="text-sm text-gray-500">Allow anyone to view your profile</p>
                        </div>

                        <Switch.Root
                            checked={privacySettings.publicProfile}
                            onCheckedChange={(checked) =>
                                setPrivacySettings(prev => ({ ...prev, publicProfile: checked }))
                            }
                            className={`w-11 h-6 rounded-full relative transition-colors ${
                                privacySettings.publicProfile ? 'bg-evonext-500' : 'bg-gray-200 dark:bg-gray-800'
                            }`}
                        >
                            <Switch.Thumb className="block w-8 h-8 bg-white rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5" />
                        </Switch.Root>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Show Activity Status</p>
                            <p className="text-sm text-gray-500">Let others see when you&apos;re active</p>
                        </div>

                        <Switch.Root
                            checked={privacySettings.showActivity}
                            onCheckedChange={(checked) =>
                                setPrivacySettings(prev => ({ ...prev, showActivity: checked }))
                            }
                            className={`w-11 h-6 rounded-full relative transition-colors ${
                                privacySettings.showActivity ? 'bg-evonext-500' : 'bg-gray-200 dark:bg-gray-800'
                            }`}
                        >
                            <Switch.Thumb className="block w-8 h-8 bg-white rounded-full transition-transform data-[state=checked]:translate-x-5 translate-x-0.5" />
                        </Switch.Root>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold mb-4">Direct Messages</h3>

                <RadioGroup.Root
                    value={privacySettings.allowMessages}
                    onValueChange={(value) =>
                        setPrivacySettings(prev => ({ ...prev, allowMessages: value }))
                    }
                    className="space-y-3"
                >
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950">
                        <RadioGroup.Item
                            value="everyone"
                            className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 data-[state=checked]:border-evonext-500"
                        >
                            <RadioGroup.Indicator className="flex items-center justify-center w-full h-full after:block after:w-2.5 after:h-2.5 after:rounded-full after:bg-evonext-500" />
                        </RadioGroup.Item>

                        <label htmlFor="everyone" className="flex-1 cursor-pointer">
                            <p className="font-medium">Everyone</p>
                            <p className="text-sm text-gray-500">Anyone can message you</p>
                        </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950">
                        <RadioGroup.Item
                            value="followers"
                            className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 data-[state=checked]:border-evonext-500"
                        >
                            <RadioGroup.Indicator className="flex items-center justify-center w-full h-full after:block after:w-2.5 after:h-2.5 after:rounded-full after:bg-evonext-500" />
                        </RadioGroup.Item>

                        <label htmlFor="followers" className="flex-1 cursor-pointer">
                            <p className="font-medium">Followers Only</p>
                            <p className="text-sm text-gray-500">Only people you follow can message you</p>
                        </label>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950">
                        <RadioGroup.Item
                            value="none"
                            className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 data-[state=checked]:border-evonext-500"
                        >
                            <RadioGroup.Indicator className="flex items-center justify-center w-full h-full after:block after:w-2.5 after:h-2.5 after:rounded-full after:bg-evonext-500" />
                        </RadioGroup.Item>

                        <label htmlFor="none" className="flex-1 cursor-pointer">
                            <p className="font-medium">No One</p>
                            <p className="text-sm text-gray-500">Disable direct messages</p>
                        </label>
                    </div>
                </RadioGroup.Root>
            </div>

            <button
                onClick={handleClearCache}
                className="ml-4 flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                title="Clear cache and reload"
            >
                <ArrowPathIcon className="h-4 w-4" />

                <span className="font-mono">
                    Clear Cache
                </span>
            </button>
        </div>
    )

    const renderAppearanceSettings = () => (
        <div className="p-6 space-y-6">
            <div>
                <h3 className="font-semibold mb-4">Theme</h3>

                <RadioGroup.Root
                    value={theme}
                    onValueChange={setTheme}
                    className="grid grid-cols-3 gap-3"
                >
                    <div className="relative">
                        <RadioGroup.Item
                            value="light"
                            className="peer sr-only"
                        />

                        <label
                            className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-evonext-500 peer-data-[state=checked]:bg-evonext-50 dark:peer-data-[state=checked]:bg-evonext-950/20 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
                        >
                            <SunIcon className="h-8 w-8" />
                            <span className="text-sm font-medium">Light</span>
                        </label>
                    </div>

                    <div className="relative">
                        <RadioGroup.Item
                            value="dark"
                            className="peer sr-only"
                        />

                        <label
                            className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-evonext-500 peer-data-[state=checked]:bg-evonext-50 dark:peer-data-[state=checked]:bg-evonext-950/20 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
                        >
                            <MoonIcon className="h-8 w-8" />
                            <span className="text-sm font-medium">Dark</span>
                        </label>
                    </div>

                    <div className="relative">
                        <RadioGroup.Item
                            value="system"
                            className="peer sr-only"
                        />

                        <label
                            className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-evonext-500 peer-data-[state=checked]:bg-evonext-50 dark:peer-data-[state=checked]:bg-evonext-950/20 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-950"
                        >
                            <ComputerDesktopIcon className="h-8 w-8" />
                            <span className="text-sm font-medium">System</span>
                        </label>
                    </div>
                </RadioGroup.Root>
            </div>

            <div>
                <h3 className="font-semibold mb-4">Display</h3>

                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
                        <p className="text-sm text-gray-500 mb-2">Font Size</p>
                        <p className="text-sm">Default size (coming soon)</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
                        <p className="text-sm text-gray-500 mb-2">Color</p>
                        <p className="text-sm">EvoNext Purple (default)</p>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderAboutSettings = () => (
        <div className="p-6 space-y-6">
            <div className="text-center py-8">
                <h1 className="text-4xl font-bold text-gradient mb-4">
                    EvoNext
                </h1>

                <p className="text-gray-500 mb-8">
                    Decentralized social media on Dash Platform
                </p>

                <div className="space-y-2 text-sm text-gray-500">
                    <p>
                        Version {packageJson.version}
                    </p>

                    <p>
                        Built with Next.js, React, and Dash Platform
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <Button variant="outline" className="w-full" asChild>
                    <Link href="/contract">
                        View Data Contract
                    </Link>
                </Button>

                <Button variant="outline" className="w-full" asChild>
                    <Link href="https://github.com/sansbankdao/evonext-app" target="_blank" rel="noopener noreferrer">
                        GitHub Repository
                    </Link>
                </Button>

                <Button variant="outline" className="w-full" asChild>
                    <Link href="https://docs.evonext.app" target="_blank" rel="noopener noreferrer">
                        Documentation
                    </Link>
                </Button>
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                <p className="text-xs text-gray-500 text-center">
                    &copy; 2025
                    <Link href="https://sansbank.org" target="_blank" className="pl-1 text-blue-400 font-medium hover:underline">
                        Sansbank DAO
                    </Link>. All rights reserved.
                </p>
            </div>
        </div>
    )

    /* F57b — the Key Manager helpers. The purpose/security enums arrive
     * as numbers OR enum strings (the wasm class vs the JSON shapes). */
    const purposeLabel = (p: any) => {
        const s = String(p).toUpperCase()
        if (p === 0 || s === 'AUTHENTICATION') return 'Authentication'
        if (p === 1 || s === 'ENCRYPTION') return 'Encryption'
        if (p === 2 || s === 'DECRYPTION') return 'Decryption'
        if (p === 3 || s === 'TRANSFER') return 'Transfer'
        return s || '?'
    }
    const securityLabel = (s: any) => {
        const u = String(s).toUpperCase()
        if (s === 0 || u === 'MASTER') return 'Master'
        if (s === 1 || u === 'CRITICAL') return 'Critical'
        if (s === 2 || u === 'HIGH') return 'High'
        if (s === 3 || u === 'MEDIUM') return 'Medium'
        return u || '?'
    }
    const capabilityHint = (p: any, sec: any) => {
        const pu = String(p).toUpperCase()
        if (p === 3 || pu === 'TRANSFER') return 'signs credit sends, token sends and Core withdrawals'
        if (p === 0 || pu === 'AUTHENTICATION') {
            const su = String(sec).toUpperCase()
            if (sec === 0 || su === 'MASTER') return 'identity management — documents need Critical or High'
            return 'signs documents: profile, posts, likes, follows, usernames'
        }
        if (p === 1 || pu === 'ENCRYPTION') return 'message encryption'
        return 'no wallet action uses this key'
    }

    const renderKeysSettings = () => (
        <div className="p-6 space-y-6">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-4">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Keys held by this session</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    A key stays in this browser until you remove it (or clear the browser). It is never shown in full — only a short fingerprint.
                    Sends are signed by the <strong>Transfer</strong> key; documents (profile, posts, usernames) are signed by an <strong>Authentication Critical/High</strong> key.
                </p>
            </div>

            <div>
                <h3 className="font-semibold mb-4">Add a key</h3>
                <div className="flex gap-2">
                    <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="Paste a private key (WIF)"
                        autoComplete="off"
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-mono"
                    />
                    <Button
                        onClick={handleAddSessionKey}
                        disabled={keysSubmitting || !keyInput.trim()}
                    >
                        {keysSubmitting ? 'Adding…' : 'Add key'}
                    </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    The key is matched against this identity&apos;s registered keys by its public-key hash — a key this identity does not carry is refused.
                </p>
            </div>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Registered keys on this identity</h3>
                    <Button variant="ghost" size="sm" onClick={() => void loadSessionKeys()} disabled={keysLoading}>
                        <ArrowPathIcon className="h-4 w-4 mr-1" />
                        {keysLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                </div>

                {keysLoading && !keysData && <p className="text-sm text-gray-500">Reading the identity&apos;s keys…</p>}

                <div className="space-y-3">
                    {(keysData?.registered ?? []).map((k) => {
                        const entry = keysData?.loaded.get(k.keyId)
                        return (
                            <div key={k.keyId} className={`rounded-lg p-4 border ${entry ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900' : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">Key #{k.keyId}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">{purposeLabel(k.purpose)}</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">{securityLabel(k.securityLevel)}</span>
                                            {entry && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-medium">
                                                    Loaded · {entry.fingerprint}…
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1.5">{capabilityHint(k.purpose, k.securityLevel)}</p>
                                    </div>
                                    {entry && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void handleRemoveSessionKey(k.keyId)}
                                            disabled={keysSubmitting}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {keysData && keysData.registered.length === 0 && (
                        <p className="text-sm text-gray-500">No registered keys found on this identity.</p>
                    )}
                </div>
            </div>
        </div>
    )

    const renderSection = () => {
        switch (activeSection) {
        case 'main':
            return renderMainSettings()
        case 'account':
            return renderAccountSettings()
        case 'keys':
            return renderKeysSettings()
        case 'notifications':
            return renderNotificationSettings()
        case 'privacy':
            return renderPrivacySettings()
        case 'appearance':
            return renderAppearanceSettings()
        case 'about':
            return renderAboutSettings()
        default:
            return renderMainSettings()
        }
    }

    const getSectionTitle = () => {
        if (activeSection === 'main') {
            return 'Settings'
        }

        const section = settingsSections.find(s => s.id === activeSection)

        return section?.label || 'Settings'
    }

    const handleClearCache = () => {
        // Clear application cache
        cacheManager.clearAll()

        // Clear browser storage
        if (typeof window !== 'undefined') {
            // Clear localStorage (except auth data)
            const keysToKeep = ['dash_identity_id', 'dash_public_address']
            const savedData: Record<string, string> = {}

            // Save auth data
            keysToKeep.forEach(key => {
                const value = localStorage.getItem(key)

                if (value) {
                    savedData[key] = value
                }
            })

            // Clear all localStorage
            localStorage.clear()

            // Restore auth data
            Object.entries(savedData).forEach(([key, value]) => {
                localStorage.setItem(key, value)
            })

            // Clear sessionStorage
            sessionStorage.clear()

            // Reload the page
            window.location.reload()
        }
    }

    return (
        <div className="min-h-screen flex">
            <Sidebar />

            <main className="flex-1 border-x border-gray-200 dark:border-gray-800 h-screen overflow-y-scroll">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-4 px-4 py-3">
                        <button
                            onClick={handleBack}
                            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>

                        <h1 className="text-xl font-bold">{getSectionTitle()}</h1>
                    </div>
                </header>

                <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                >
                    {renderSection()}
                </motion.div>
            </main>

            <RightSidebar />
        </div>
    )
}

export default withAuth(SettingsPage)
