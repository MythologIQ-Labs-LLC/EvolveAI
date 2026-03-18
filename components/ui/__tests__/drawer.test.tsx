import { render, screen } from '@testing-library/react';
import { Drawer, DrawerTrigger, DrawerContent } from '../drawer';
import React from 'react';

describe('Drawer', () => {
  it('renders and opens/closes content', async () => {
    render(
      <Drawer>
        <DrawerTrigger>Open Drawer</DrawerTrigger>
        <DrawerContent>Drawer Content</DrawerContent>
      </Drawer>
    );
    expect(screen.queryByText('Drawer Content')).not.toBeInTheDocument();
    screen.getByText('Open Drawer').click();
    expect(await screen.findByText('Drawer Content')).toBeInTheDocument();
  });
}); 