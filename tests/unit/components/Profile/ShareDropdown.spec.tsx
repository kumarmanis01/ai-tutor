import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ShareDropdown } from '@/components/Profile/ShareDropdown';

jest.mock('@/lib/analytics/client', () => ({ default: { trackEvent: jest.fn() } }));
jest.mock('@/lib/analytics/events', () => ({ ANALYTICS_EVENTS: { STUDENT: { BADGE_SHARE_BADGE: 'badge_share', BADGE_SHARE_PLATFORM: 'badge_platform' } } }));

describe('ShareDropdown', () => {
  it('renders share trigger button', () => {
    render(<ShareDropdown badgeId="b1" title="First Badge" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens popover on click', () => {
    render(<ShareDropdown badgeId="b1" title="First Badge" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('shows all four share options', () => {
    render(<ShareDropdown badgeId="b1" title="First Badge" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    render(<ShareDropdown badgeId="b1" title="First Badge" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
