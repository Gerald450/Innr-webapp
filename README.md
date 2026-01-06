# Innr

A modern campus social networking platform that connects students and enables them to share posts, discover events, and engage with their university community.

## Overview

Innr is a full-stack social networking web application designed for university campuses. It provides a space for students to create and share posts, discover and attend events, interact with content through likes, comments, reposts, and bookmarks, and stay connected with their campus community.

## Features

### Core Functionality
- **Posts**: Create, view, and interact with posts
  - Like, comment, repost, and bookmark posts
  - Image uploads and media support
  - Real-time updates
  - Event-tagged posts

- **Events**: Discover and manage campus events
  - Calendar view for event browsing
  - Event creation with details (date, time, location)
  - Event attendance tracking
  - Event-specific posts

- **User Profiles**: 
  - Customizable user profiles
  - Profile editing
  - User avatars
  - View other users' profiles

- **Notifications**: 
  - Real-time notification system
  - Unread notification tracking

- **Authentication**:
  - Secure sign in/sign up
  - Password reset functionality
  - Session management with Supabase

- **Admin Features**:
  - Admin role with special permissions
  - Post creation capabilities
  - Content management

- **User Experience**:
  - Dark/Light theme support
  - Responsive design
  - Optimistic UI updates
  - Cache management with React Query

## Tech Stack

### Frontend
- **[Next.js 16](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS 4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Geist Font](https://vercel.com/font)** - Optimized font family

### Backend & Database
- **[Supabase](https://supabase.com/)** - Backend-as-a-Service
  - Authentication
  - PostgreSQL database
  - Real-time subscriptions
  - Storage for media files

### State Management & Data Fetching
- **[TanStack Query (React Query)](https://tanstack.com/query)** - Server state management and data fetching
  - Optimistic updates
  - Cache invalidation
  - Automatic refetching

### Testing
- **[Vitest](https://vitest.dev/)** - Unit and integration testing framework
- **[Testing Library](https://testing-library.com/)** - React component testing utilities
- **[MSW (Mock Service Worker)](https://mswjs.io/)** - API mocking for tests
- Test coverage reporting

### Development Tools
- **ESLint** - Code linting
- **TypeScript** - Static type checking

## Project Structure

```
my-app/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── events/            # Events pages
│   ├── posts/             # Posts pages
│   ├── profile/           # User profile pages
│   ├── notifications/     # Notifications page
│   └── signin/            # Authentication pages
├── components/            # React components
│   ├── EventsCard.tsx
│   ├── PostsCard.tsx
│   ├── MakePost.tsx
│   ├── Navbar.tsx
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── usePosts.tsx
│   ├── useEvents.tsx
│   ├── useProfile.tsx
│   └── ...
├── lib/                   # Utility libraries
│   └── supabaseClient.ts
├── utils/                 # Helper functions
│   ├── cacheInvalidation.ts
│   ├── relativeTime.ts
│   └── storage.ts
└── tests/                 # Test files
    ├── api/
    ├── hooks/
    ├── functionality/
    └── ...
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd my-app
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

## Testing

The project includes comprehensive test coverage for:
- API routes (authentication, cookie management)
- React hooks (posts, events, profile, notifications)
- Component functionality (post creation, interactions, events)
- Concurrent operations and cache consistency
- Utility functions

Run tests with:
```bash
npm run test
```

## Deployment

The easiest way to deploy this Next.js app is using [Vercel](https://vercel.com):

1. Push your code to a Git repository
2. Import your project on Vercel
3. Add your environment variables
4. Deploy

For more details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

## License

Private project - All rights reserved

## Author

Created by Gerald Shimo
