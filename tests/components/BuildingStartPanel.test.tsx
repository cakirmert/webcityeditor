import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuildingStartPanel from '../../src/components/BuildingStartPanel';

describe('<BuildingStartPanel />', () => {
  it('offers a custom outline and two official touch-ready LoD3 assets', () => {
    const onDrawCustom = vi.fn();
    const onPlaceAsset = vi.fn();
    render(
      <BuildingStartPanel
        onDrawCustom={onDrawCustom}
        onPlaceAsset={onPlaceAsset}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Ready-made LoD3 buildings')).toBeInTheDocument();
    expect(screen.getByText('Round courtyard')).toBeInTheDocument();
    expect(screen.getByText('Industrial hall')).toBeInTheDocument();
    expect(screen.getAllByText('Place')).toHaveLength(2);

    fireEvent.click(screen.getByText('Draw outline'));
    expect(onDrawCustom).toHaveBeenCalledOnce();

    fireEvent.click(screen.getAllByText('Place')[0]);
    expect(onPlaceAsset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'hamburg-lod3-round-courtyard' })
    );
  });
});
