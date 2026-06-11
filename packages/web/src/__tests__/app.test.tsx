import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'
import { useAuthStore } from '../store/auth'

describe('App', () => {
  beforeAll(() => {
    // AppRoutes has an auth guard that redirects to /login when unauthenticated
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'test-user', name: 'Test Admin', email: 'test@test.com', role: 'admin' } as any,
      accessToken: 'test-token',
    })
  })

  it('renders app shell with Dashboard navigation', () => {
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    )
    // DashboardPage itself renders a loading skeleton until /api/dashboard
    // resolves, so assert on the stable app shell instead
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
  })

  it('renders sidebar navigation', () => {
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    )
    expect(screen.getAllByText('Agents').length).toBeGreaterThan(0)
    expect(screen.getByText('Boards')).toBeTruthy()
    expect(screen.getAllByText('Specs').length).toBeGreaterThan(0)
  })
})
