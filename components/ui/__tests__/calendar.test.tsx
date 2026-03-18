import { render, screen } from '@testing-library/react';
import { Calendar } from '../calendar';
import React from 'react';

describe('Calendar', () => {
  it('renders a native date input', () => {
    render(<Calendar />);
    const input = screen.getByTestId('date-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'date');
  });
}); 