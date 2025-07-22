'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { PostCard } from '@/components/post/post-card'
import { Sidebar } from '@/components/layout/sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { ComposeModal } from '@/components/compose/compose-modal'
import { useAppStore } from '@/lib/store'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import * as Tabs from '@radix-ui/react-tabs'
import { withAuth, useAuth } from '@/contexts/auth-context'
import { AvatarCanvas } from '@/components/ui/avatar-canvas'
import { generateAvatarV2 } from '@/lib/avatar-generator-v2'
import { LoadingState, useAsyncState } from '@/components/ui/loading-state'
import ErrorBoundary from '@/components/error-boundary'
import { getDashPlatformClient } from '@/lib/dash-platform-client'

function FeedPage() {
  const [activeTab, setActiveTab] = useState('for-you')
  const [isHydrated, setIsHydrated] = useState(false)
  const { setComposeOpen } = useAppStore()
  const { user } = useAuth()
  const postsState = useAsyncState<any[]>([])
  
  // Prevent hydration mismatches
  useEffect(() => {
    setIsHydrated(true)
  }, [])
  
  // Generate avatar based on identity ID (only after hydration)
  const avatarFeatures = user && isHydrated ? generateAvatarV2(user.identityId) : null
  
  // Load posts function - using real WASM SDK with updated version
  const loadPosts = useCallback(async () => {
    postsState.setLoading(true)
    postsState.setError(null)
    
    try {
      console.log('Feed: Loading posts from Dash Platform...')
      
      const dashClient = getDashPlatformClient()
      
      // Query posts from the platform
      const posts = await dashClient.queryPosts({
        limit: 20,
        forceRefresh: false
      })
      
      console.log('Feed: Raw posts from platform:', posts)
      
      // Transform posts to match our UI format
      const transformedPosts = posts.map((doc: any) => {
        // Extract the document data
        const data = doc.data || doc
        
        return {
          id: doc.id || doc.$id || Math.random().toString(36).substr(2, 9),
          content: data.content || 'No content',
          author: {
            id: data.authorId || doc.$ownerId || 'unknown',
            username: `user_${(data.authorId || doc.$ownerId || 'unknown').slice(-6)}`,
            handle: `user_${(data.authorId || doc.$ownerId || 'unknown').slice(-6)}`
          },
          timestamp: data.$createdAt || doc.$createdAt || new Date().toISOString(),
          likes: Math.floor(Math.random() * 50), // Placeholder until we implement likes
          replies: Math.floor(Math.random() * 20), // Placeholder until we implement replies
          reposts: Math.floor(Math.random() * 10), // Placeholder until we implement reposts  
          views: Math.floor(Math.random() * 200) // Placeholder until we implement views
        }
      })
      
      console.log('Feed: Transformed posts:', transformedPosts)
      
      // If no posts found, show helpful message but don't error
      if (transformedPosts.length === 0) {
        console.log('Feed: No posts found on platform')
        postsState.setData([])
      } else {
        postsState.setData(transformedPosts)
        console.log(`Feed: Successfully loaded ${transformedPosts.length} posts`)
      }
      
    } catch (error) {
      console.error('Feed: Failed to load posts from platform:', error)
      
      // Show specific error message but fall back gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.log('Feed: Falling back to empty state due to error:', errorMessage)
      
      // Set empty data instead of showing error to user
      postsState.setData([])
      
      // Only show error to user if it's a critical issue
      if (errorMessage.includes('Contract ID not configured') || 
          errorMessage.includes('Not logged in')) {
        postsState.setError(errorMessage)
      }
    } finally {
      postsState.setLoading(false)
    }
  }, [postsState])

  // Load posts on mount and listen for new posts
  useEffect(() => {
    loadPosts()
    
    // Listen for new posts created
    const handlePostCreated = () => {
      loadPosts()
    }
    
    window.addEventListener('post-created', handlePostCreated)
    
    return () => {
      window.removeEventListener('post-created', handlePostCreated)
    }
  }, [loadPosts])

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <main className="flex-1 ml-[275px] mr-[350px] max-w-[600px] border-x border-gray-200 dark:border-gray-800">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">Home</h1>
          </div>
          
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="flex border-b border-gray-200 dark:border-gray-800">
              <Tabs.Trigger
                value="for-you"
                className="flex-1 py-4 font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors relative data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                For you
                {activeTab === 'for-you' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-yappr-500"
                  />
                )}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="following"
                className="flex-1 py-4 font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors relative data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
              >
                Following
                {activeTab === 'following' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-yappr-500"
                  />
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </header>

        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex gap-3">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
              {isHydrated ? (
                avatarFeatures ? (
                  <AvatarCanvas features={avatarFeatures} size={48} />
                ) : user ? (
                  <Avatar>
                    <AvatarFallback>{user.identityId.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar>
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                )
              ) : (
                <div className="w-full h-full bg-gray-300 dark:bg-gray-700 animate-pulse rounded-full" />
              )}
            </div>
            <button
              onClick={() => setComposeOpen(true)}
              className="flex-1 text-left px-4 py-3 bg-gray-50 dark:bg-gray-950 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            >
              What&apos;s happening?
            </button>
            <button className="p-3 rounded-full hover:bg-yappr-50 dark:hover:bg-yappr-950 text-yappr-500">
              <SparklesIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <ErrorBoundary level="component">
          <LoadingState
            loading={postsState.loading}
            error={postsState.error}
            isEmpty={postsState.data?.length === 0}
            onRetry={loadPosts}
            loadingText="Loading posts..."
            emptyText="No posts yet"
            emptyDescription="Be the first to share something!"
          >
            <div>
              {postsState.data?.map((post) => (
                <ErrorBoundary key={post.id} level="component">
                  <PostCard post={post} />
                </ErrorBoundary>
              ))}
            </div>
          </LoadingState>
        </ErrorBoundary>
      </main>

      <RightSidebar />
      <ComposeModal />
    </div>
  )
}

export default withAuth(FeedPage, { optional: true })