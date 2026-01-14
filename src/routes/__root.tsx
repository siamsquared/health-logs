import { Outlet, createRootRoute, useNavigate, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useAuth } from '@/features/auth/useAuth'
import { useEffect } from 'react'

export const Route = createRootRoute({
  component: () => <RootComponent />,
})

function RootComponent() {
  const { user, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (status === 'authenticated' && user && !user.isProfileSetup) {
      if (location.pathname !== '/profile') {
        navigate({ to: '/profile' })
      }
    }
  }, [status, user, navigate, location.pathname])

  return (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
