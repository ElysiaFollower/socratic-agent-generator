/**
 * Tests for the main App component.
 *
 * This file contains unit tests for the App component.
 */

import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import App from '../App';

// Mock the API modules
vi.mock('../api/profiles', () => ({
  listProfiles: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../api/sessions', () => ({
  listSessions: vi.fn(() => Promise.resolve([])),
}));

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText(/苏格拉底式AI导师/i)).toBeInTheDocument();
  });
});


