import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'

describe('App', () => {
  it('renders dashboard heading', () => {
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeTruthy()
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
