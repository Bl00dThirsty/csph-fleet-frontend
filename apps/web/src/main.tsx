import { StrictMode, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { handleServerError } from '@/lib/handle-server-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { usePickupsStore } from './store/pickups-store'
import { useToursStore } from './store/tours-store'
import { useUsersStore } from './store/users-store'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(
          error instanceof AxiosError &&
          [401, 403].includes(error.response?.status ?? 0)
        )
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)

        if (error instanceof AxiosError) {
          if (error.response?.status === 304) {
            toast.error('Content not modified!')
          }
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          toast.error('Session expirée. Veuillez vous reconnecter.')
          queryClient.clear()
          router.navigate({ to: '/login' })
        }
        if (error.response?.status === 500) {
          toast.error('Internal server error.')
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFoundError,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 3.8 — Single mount hydration for fetchUsers/fetchTours/fetchPickups.
// The module-level promise guards against double-run (React StrictMode
// mounts effects twice in dev): every caller shares the one in-flight
// request, and per-page refreshes no-op while the data is fresh (see
// @/lib/hydration) instead of firing duplicate network storms.
let appHydrationPromise: Promise<void> | null = null

function hydrateAppOnce(): Promise<void> {
  if (!appHydrationPromise) {
    appHydrationPromise = Promise.allSettled([
      useUsersStore.getState().fetchUsers(),
      useToursStore.getState().fetchTours(),
      usePickupsStore.getState().fetchPickups(),
    ]).then(() => undefined)
  }
  return appHydrationPromise
}

function AppHydration() {
  useEffect(() => {
    void hydrateAppOnce()
  }, [])
  return null
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme='light'>
          <FontProvider>
            <DirectionProvider>
              <AppHydration />
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
