import { render, screen } from '@testing-library/react';
import { Settings } from '../../settings';
import { SettingsProvider } from '../../../hooks/use-settings';
import React from 'react';

describe('Settings About Section', () => {
  it('shows MythologIQ logo and built by text', () => {
    render(
      <SettingsProvider>
        <Settings />
      </SettingsProvider>
    );
    expect(screen.getByText(/built by/i)).toBeInTheDocument();
    expect(screen.getAllByText(/MythologIQ/i)).toHaveLength(2);
  });
}); 