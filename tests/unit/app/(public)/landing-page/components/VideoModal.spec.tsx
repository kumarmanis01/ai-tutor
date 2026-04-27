/**
 * FILE OBJECTIVE:
 * - Unit tests for VideoModal component: renders, closes on backdrop click/Escape,
 *   does not render when isOpen=false.
 *
 * LINKED UNIT TEST: this file is the test
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 VideoModal component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideoModal from '@/app/(public)/landing-page/components/VideoModal';

jest.mock('@/components/UI/AppIcon', () => {
  const MockIcon = ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />;
  MockIcon.displayName = 'AppIcon';
  return MockIcon;
});

describe('VideoModal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(<VideoModal isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render iframe when isOpen is true', () => {
    render(<VideoModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByTitle('Spinzy Academy product demo')).toBeInTheDocument();
  });

  it('should have correct role and aria attributes', () => {
    render(<VideoModal isOpen={true} onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Product demo video');
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<VideoModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close video'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<VideoModal isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<VideoModal isOpen={true} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    // Simulate click directly on the backdrop (not the child)
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should accept a custom embedUrl', () => {
    render(
      <VideoModal
        isOpen={true}
        onClose={jest.fn()}
        embedUrl="https://www.youtube.com/embed/test123"
      />
    );
    const iframe = screen.getByTitle('Spinzy Academy product demo') as HTMLIFrameElement;
    expect(iframe.src).toContain('test123');
  });
});
