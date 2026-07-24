import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterBar from '../../src/components/FilterBar';
import type { Footprint } from '../../src/lib/footprints';

const footprints: Footprint[] = [
  {
    id: 'building-a',
    type: 'Building',
    polygon: [
      [9.99, 53.55, 0],
      [9.991, 53.55, 0],
      [9.991, 53.551, 0],
      [9.99, 53.55, 0],
    ],
    height: 12,
    baseElevation: 0,
    attributes: { roofType: 'gable', yearOfConstruction: 1990 },
  },
  {
    id: 'building-b',
    type: 'Building',
    polygon: [
      [9.992, 53.55, 0],
      [9.993, 53.55, 0],
      [9.993, 53.551, 0],
      [9.992, 53.55, 0],
    ],
    height: 18,
    baseElevation: 0,
    attributes: { roofType: 'flat', yearOfConstruction: 2010 },
  },
];

describe('<FilterBar />', () => {
  it('shows all search controls in one touch-sized map overlay', () => {
    const onClose = vi.fn();
    render(
      <FilterBar
        footprints={footprints}
        filter={{}}
        onChange={vi.fn()}
        matchCount={footprints.length}
        onClose={onClose}
      />
    );

    expect(
      screen.getByRole('dialog', { name: 'Search and filter buildings' })
    ).toHaveClass('absolute', 'z-[55]');
    expect(screen.getByRole('searchbox', { name: 'Search buildings' })).toHaveClass(
      'min-h-12'
    );
    expect(screen.getByRole('region', { name: 'Building filters' })).toHaveClass(
      'flex',
      'flex-wrap'
    );
    expect(screen.getByRole('button', { name: 'gable' })).toHaveClass(
      'min-h-12',
      'min-w-12'
    );
    expect(screen.getByRole('button', { name: 'flat' })).toHaveClass(
      'min-h-12',
      'min-w-12'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close search and filters' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from Escape', () => {
    const onClose = vi.fn();
    render(
      <FilterBar
        footprints={footprints}
        filter={{}}
        onChange={vi.fn()}
        matchCount={footprints.length}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
