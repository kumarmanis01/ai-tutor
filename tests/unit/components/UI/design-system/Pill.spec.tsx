import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Pill, ReadinessPill } from '@/components/UI/design-system/Pill';

describe('Pill', () => {
  it('renders children', () => {
    render(<Pill>Tag</Pill>);
    expect(screen.getByText('Tag')).toBeInTheDocument();
  });

  it.each([['amber'], ['mint'], ['critical'], ['primary'], ['ghost']] as const)(
    'renders intent %s without crash',
    (intent) => {
      render(<Pill intent={intent}>{intent}</Pill>);
      expect(screen.getByText(intent)).toBeInTheDocument();
    },
  );

  it('renders left and right icons', () => {
    render(
      <Pill leftIcon={<span data-testid="left" />} rightIcon={<span data-testid="right" />}>
        text
      </Pill>,
    );
    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
  });
});

describe('ReadinessPill', () => {
  it.each([
    ['critical', 'Critical'],
    ['weak', 'Weak'],
    ['fair', 'Fair'],
    ['on track', 'On track'],
    ['strong', 'Strong'],
  ] as const)(
    'renders tier %s as label "%s"',
    (tier, label) => {
      render(<ReadinessPill tier={tier} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );
});
