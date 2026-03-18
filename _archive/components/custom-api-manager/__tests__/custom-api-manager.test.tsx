import { render, screen } from '@testing-library/react';
import CustomAPIManager from '../../custom-api-manager';
import React from 'react';

describe('CustomAPIManager', () => {
  it('renders the create new API button', () => {
    render(<CustomAPIManager />);
    expect(screen.getByRole('button', { name: /create new api/i })).toBeInTheDocument();
  });
}); 