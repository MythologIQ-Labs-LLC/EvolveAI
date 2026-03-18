import { render, screen } from '@testing-library/react';
import UpdateChecker from '../../update-checker';
import React from 'react';

describe('UpdateChecker', () => {
  it('renders current version and update button', () => {
    render(<UpdateChecker currentVersion="1.0.0" />);
    expect(screen.getByText(/current version/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /checking/i })).toBeInTheDocument();
  });
}); 