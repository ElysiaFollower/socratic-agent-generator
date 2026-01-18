/**
 * Tests for the main App component.
 *
 * This file contains unit tests for the App component.
 */

import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import App from '../App';
import {AuthProvider} from '../contexts/AuthContext';

// Mock the API modules
vi.mock('../api/profiles', () => ({
  listProfiles: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../api/sessions', () => ({
  listSessions: vi.fn(() => Promise.resolve([])),
}));

describe('App', () => {
  it('should render login page when unauthenticated', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </AuthProvider>,
    );
    expect(
      await screen.findByText(/登录到苏格拉底式AI导师系统/i),
    ).toBeInTheDocument();
  });
});



