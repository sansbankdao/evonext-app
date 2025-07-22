'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  FaceSmileIcon,
  InformationCircleIcon,
  EllipsisHorizontalIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { Sidebar } from '@/components/layout/sidebar'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { withAuth, useAuth } from '@/contexts/auth-context'
import { AvatarCanvas } from '@/components/ui/avatar-canvas'
import { generateAvatarV2 } from '@/lib/avatar-generator-v2'
import { formatDistanceToNow } from 'date-fns'

interface Message {
  id: string
  content: string
  senderId: string
  timestamp: Date
  read: boolean
}

interface Conversation {
  id: string
  participantId: string
  lastMessage: Message
  unreadCount: number
}

function MessagesPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading conversations
    setTimeout(() => {
      const mockConversations: Conversation[] = [
        {
          id: '1',
          participantId: 'user123',
          lastMessage: {
            id: 'm1',
            content: 'Hey! Have you tried the new Dash Platform features?',
            senderId: 'user123',
            timestamp: new Date(Date.now() - 1000 * 60 * 5),
            read: false
          },
          unreadCount: 1
        },
        {
          id: '2',
          participantId: 'user456',
          lastMessage: {
            id: 'm2',
            content: 'Thanks for the follow! 🎉',
            senderId: user?.identityId || '',
            timestamp: new Date(Date.now() - 1000 * 60 * 60),
            read: true
          },
          unreadCount: 0
        },
        {
          id: '3',
          participantId: 'user789',
          lastMessage: {
            id: 'm3',
            content: 'The decentralized future is here',
            senderId: 'user789',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
            read: true
          },
          unreadCount: 0
        }
      ]
      setConversations(mockConversations)
      setIsLoading(false)
    }, 1000)
  }, [user])

  useEffect(() => {
    if (selectedConversation) {
      // Simulate loading messages for selected conversation
      const mockMessages: Message[] = [
        {
          id: 'm1',
          content: 'Hey there! 👋',
          senderId: selectedConversation.participantId,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
          read: true
        },
        {
          id: 'm2',
          content: 'Hi! How are you?',
          senderId: user?.identityId || '',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5),
          read: true
        },
        {
          id: 'm3',
          content: 'Have you tried the new Dash Platform features?',
          senderId: selectedConversation.participantId,
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          read: true
        }
      ]
      setMessages(mockMessages)
      
      // Mark conversation as read
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, unreadCount: 0 }
          : conv
      ))
    }
  }, [selectedConversation, user])

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConversation || !user) return

    const message: Message = {
      id: `m${Date.now()}`,
      content: newMessage,
      senderId: user.identityId,
      timestamp: new Date(),
      read: true
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')
    
    // Update last message in conversation
    setConversations(prev => prev.map(conv => 
      conv.id === selectedConversation.id
        ? { ...conv, lastMessage: message }
        : conv
    ))
  }

  const filteredConversations = conversations.filter(conv => 
    conv.participantId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <main className="flex-1 ml-[275px] max-w-[1000px] border-x border-gray-200 dark:border-gray-800 flex">
        {/* Conversations List */}
        <div className="w-[400px] border-r border-gray-200 dark:border-gray-800 flex flex-col">
          <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between px-4 py-3">
              <h1 className="text-xl font-bold">Messages</h1>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="px-4 pb-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </header>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
              <PaperAirplaneIcon className="h-12 w-12 text-gray-300 mb-4" />
              <h2 className="text-xl font-semibold mb-2">No messages yet</h2>
              <p className="text-gray-500 text-sm">When someone messages you, it&apos;ll show up here</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors flex gap-3 ${
                    selectedConversation?.id === conversation.id ? 'bg-gray-50 dark:bg-gray-950' : ''
                  }`}
                >
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    <AvatarCanvas features={generateAvatarV2(conversation.participantId)} size={48} />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">
                        {conversation.participantId.slice(0, 8)}...
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(conversation.lastMessage.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {conversation.lastMessage.senderId === user?.identityId && 'You: '}
                      {conversation.lastMessage.content}
                    </p>
                  </div>
                  
                  {conversation.unreadCount > 0 && (
                    <div className="flex items-center">
                      <div className="bg-yappr-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {conversation.unreadCount}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message Thread */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col">
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                    <AvatarCanvas features={generateAvatarV2(selectedConversation.participantId)} size={40} />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedConversation.participantId.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">Active now</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                    <InformationCircleIcon className="h-5 w-5" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full">
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const isOwn = message.senderId === user?.identityId
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-yappr-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 px-2">
                        {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full"
                >
                  <PhotoIcon className="h-5 w-5" />
                </button>
                
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                />
                
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full"
                >
                  <FaceSmileIcon className="h-5 w-5" />
                </button>
                
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newMessage.trim()}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <PaperAirplaneIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Select a message</h2>
              <p className="text-gray-500">Choose from your existing conversations or start a new one</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default withAuth(MessagesPage)