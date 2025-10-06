import { render, screen } from '@testing-library/react'

describe('smoke test', () => {
  it('renders placeholder text', () => {
    render(<div>Finance App</div>)
    expect(screen.getByText(/finance app/i)).toBeInTheDocument()
  })
})