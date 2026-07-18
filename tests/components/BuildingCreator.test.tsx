import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/Viewer', () => ({
  default: () => <div data-testid="mock-viewer" />,
}));

import BuildingCreator from '../../src/components/BuildingCreator';
import { buildSampleCube } from '../../src/lib/cityjson';

const RECT_DELFT: [number, number][] = [
  [4.3571, 52.0116],
  [4.35734, 52.0116],
  [4.35734, 52.0117],
  [4.3571, 52.0117],
];

describe('<BuildingCreator /> overhang controls', () => {
  it('enables flat eave overhang and emits it in form state', async () => {
    const onFormChange = vi.fn();
    const { container } = render(
      <BuildingCreator
        vertexCount={RECT_DELFT.length}
        footprint={RECT_DELFT}
        cityjson={buildSampleCube()}
        onFormChange={onFormChange}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const eaveInput = container.querySelector(
      'input[title="Flat roof eave overhang in metres"]'
    ) as HTMLInputElement | null;
    expect(eaveInput).not.toBeNull();
    expect(eaveInput!.disabled).toBe(false);

    fireEvent.change(eaveInput!, { target: { value: '0.4' } });

    await waitFor(() => {
      const last = onFormChange.mock.calls.at(-1)?.[0];
      expect(last?.eaveOverhang).toBe(0.4);
    });
  });

  it('disables eave overhang when switching to a pitched roof', async () => {
    const onFormChange = vi.fn();
    const { container, getByText } = render(
      <BuildingCreator
        vertexCount={RECT_DELFT.length}
        footprint={RECT_DELFT}
        cityjson={buildSampleCube()}
        onFormChange={onFormChange}
        onCreate={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(getByText('Gable'));
    await waitFor(() => {
      const eaveInput = container.querySelector(
        'input[title="Pitched roof overhangs are disabled until a validated slab model is available"]'
      ) as HTMLInputElement | null;
      expect(eaveInput).not.toBeNull();
      expect(eaveInput!.disabled).toBe(true);
      const last = onFormChange.mock.calls.at(-1)?.[0];
      expect(last?.eaveOverhang).toBe(0);
    });
  });
});
