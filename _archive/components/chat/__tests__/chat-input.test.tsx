import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from '../chat-input';
import React from 'react';

describe('ChatInput', () => {
  it('renders and accepts user text', () => {
    render(<ChatInput />);
    const input = screen.getByPlaceholderText(/type your message/i);
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Hello AI' } });
    expect(input.value).toBe('Hello AI');
  });
}); 