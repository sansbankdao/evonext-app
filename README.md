# EvoNext - Modern Social Platform

A Twitter/Bluesky-inspired social media application built with Next.js 14 and Dash Platform, focusing on exceptional UI/UX design and smooth interactions.

## Features

- 🎨 Beautiful, modern UI with attention to detail
- 🌓 Dark/Light mode support
- 💬 Post creation up to 500 characters
- 👤 Customizable avatars with 32 properties
- 🔄 Real-time updates with mock data
- 📱 Responsive design
- ✨ Smooth animations with Framer Motion
- 🎯 Accessible components with Radix UI
- 🔐 Dash Platform integration with DPNS support

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI for accessibility
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Icons**: Heroicons
- **Notifications**: React Hot Toast

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Design Highlights

- Custom color palette with EvoNext brand colors
- Smooth micro-interactions on all interactive elements
- Glass morphism effects for modern aesthetics
- Thoughtful loading states and transitions
- Consistent spacing and typography system

## Project Structure

```
yappr/
├── app/              # Next.js app directory
├── components/       # React components
│   ├── ui/          # Reusable UI components
│   ├── layout/      # Layout components
│   ├── post/        # Post-related components
│   └── compose/     # Post composition components
├── lib/             # Utilities and data
│   ├── store.ts     # Zustand store
│   ├── types.ts     # TypeScript types
│   ├── utils.ts     # Helper functions
│   ├── mock-data.ts # Mock data for development
│   ├── avatar-generator-v2.ts # Avatar generation system
│   └── dash-platform.ts # Dash Platform integration
├── contracts/       # Dash Platform contracts
│   └── yappr-social-contract.json
└── public/          # Static assets
```

## Dash Platform Integration

EvoNext uses Dash Platform for decentralized data storage:

- **Profiles**: Stored without usernames (usernames come from DPNS)
- **Avatars**: Stored as separate documents with encoded customization data
- **Posts**: Support up to 500 characters with media attachments
- **Social Features**: Likes, reposts, follows, and bookmarks

### Data Contract Structure

- `profile`: User profiles indexed by $ownerId
- `avatar`: Avatar customization data (version, data, style)
- `post`: User posts with 500 character limit
- `like`, `repost`, `follow`: Social interactions
- `bookmark`, `list`, `block`, `mute`: User preferences
- `directMessage`: Encrypted DMs
- `notification`: User notifications
