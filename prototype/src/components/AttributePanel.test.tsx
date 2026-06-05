import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttributePanel from './AttributePanel';
import { buildSampleCube } from '../lib/cityjson';

function setup(overrides: Partial<React.ComponentProps<typeof AttributePanel>> = {}) {
  const cityjson = buildSampleCube();
  const onAttributeChange = vi.fn();
  const onRevert = vi.fn();
  const onClose = vi.fn();

  const utils = render(
    <AttributePanel
      buildingId="Building_A"
      cityjson={cityjson}
      isDirty={false}
      onAttributeChange={onAttributeChange}
      onRevert={onRevert}
      onClose={onClose}
      {...overrides}
    />
  );
  return { ...utils, cityjson, onAttributeChange, onRevert, onClose };
}

describe('<AttributePanel />', () => {
  it('renders the building type as heading', () => {
    setup();
    expect(screen.getByText('Building')).toBeInTheDocument();
  });

  it('shows the building ID', () => {
    setup();
    expect(screen.getByText('Building_A')).toBeInTheDocument();
  });

  it('renders an input for every attribute', () => {
    setup();
    // sample cube has 4 attrs
    expect(screen.getByLabelText('measuredHeight')).toBeInTheDocument();
    expect(screen.getByLabelText('yearOfConstruction')).toBeInTheDocument();
    expect(screen.getByLabelText('storeysAboveGround')).toBeInTheDocument();
    expect(screen.getByLabelText('function')).toBeInTheDocument();
  });

  it('lists attributes with priority ordering (measuredHeight before function)', () => {
    setup();
    const labels = screen.getAllByText(
      /measuredHeight|yearOfConstruction|storeysAboveGround|function/
    );
    // measuredHeight should appear before function in the DOM
    const text = labels.map((el) => el.textContent);
    const hIdx = text.indexOf('measuredHeight');
    const fIdx = text.indexOf('function');
    expect(hIdx).toBeGreaterThanOrEqual(0);
    expect(fIdx).toBeGreaterThanOrEqual(0);
    expect(hIdx).toBeLessThan(fIdx);
  });

  // fireEvent.change is used instead of userEvent.type because the panel is a
  // controlled input whose value prop is not re-derived in the test harness —
  // character-by-character typing would not accumulate state.
  it('calls onAttributeChange with numeric value when a number input is edited', () => {
    const { onAttributeChange } = setup();
    const input = screen.getByLabelText('measuredHeight') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '42' } });
    const lastCall =
      onAttributeChange.mock.calls[onAttributeChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe('Building_A');
    expect(lastCall[1]).toBe('measuredHeight');
    expect(typeof lastCall[2]).toBe('number');
    expect(lastCall[2]).toBe(42);
  });

  it('calls onAttributeChange with string value when a text input is edited', () => {
    const { onAttributeChange } = setup();
    const input = screen.getByLabelText('function') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'office' } });
    const lastCall =
      onAttributeChange.mock.calls[onAttributeChange.mock.calls.length - 1];
    expect(lastCall[1]).toBe('function');
    expect(typeof lastCall[2]).toBe('string');
    expect(lastCall[2]).toBe('office');
  });

  it('converts empty numeric input to null', () => {
    const { onAttributeChange } = setup();
    const input = screen.getByLabelText('measuredHeight') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    const lastCall =
      onAttributeChange.mock.calls[onAttributeChange.mock.calls.length - 1];
    expect(lastCall[2]).toBeNull();
  });

  it('calls onClose when the close button is clicked', async () => {
    const { onClose } = setup();
    const btn = screen.getByLabelText('Close');
    await userEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables the revert button when not dirty', () => {
    setup({ isDirty: false });
    const btn = screen.getByText(/Revert this building/) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables and fires revert when dirty', async () => {
    const { onRevert } = setup({ isDirty: true });
    const btn = screen.getByText(/Revert this building/) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await userEvent.click(btn);
    expect(onRevert).toHaveBeenCalledWith('Building_A');
  });

  it('shows terrain-aware dZ controls while editing position', async () => {
    const onUpdateTransform = vi.fn();
    setup({
      pendingTransform: {
        id: 'Building_A',
        dx: 0,
        dy: 0,
        dz: 0,
        angle: 0,
        autoTerrain: true,
      },
      onUpdateTransform,
      onCancelTransform: vi.fn(),
      onSaveTransform: vi.fn(),
      terrainSnap: {
        sourceBaseElevation: 0,
        terrainElevation: 3.5,
        requiredDz: 3.5,
        currentGroundElevation: 0,
        difference: 3.5,
        terrainSource: 'nearest-building-ground',
        matchedBuildingId: 'terrain-proxy',
        distanceMeters: 7,
      },
    });

    expect(screen.getByLabelText('dZ')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('dZ terrain offset slider'), {
      target: { value: '1.5' },
    });
    expect(onUpdateTransform).toHaveBeenLastCalledWith({ dz: 1.5 });

    await userEvent.click(screen.getByText('Snap ground to terrain'));
    expect(onUpdateTransform).toHaveBeenLastCalledWith({ dz: 3.5, autoTerrain: true });
  });

  it('applies one manually adjusted footprint plan to every floor', async () => {
    const onSplitByFloorPlans = vi.fn();
    setup({ onSplitByFloorPlans });

    await userEvent.click(screen.getByText('Edit plans'));
    const checkbox = screen.getByLabelText(
      'Use the same floor plan for all floors'
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    const cut = screen.getByLabelText('Cut 1 percent') as HTMLInputElement;
    fireEvent.change(cut, { target: { value: '40' } });
    await userEvent.click(screen.getByText('Apply floor plans'));

    expect(onSplitByFloorPlans).toHaveBeenCalledTimes(1);
    const [id, heights, plans] = onSplitByFloorPlans.mock.calls[0];
    expect(id).toBe('Building_A');
    expect(heights).toEqual([5, 5]);
    expect(plans).toHaveLength(2);
    expect(plans[0].cutFractions).toEqual([0.4]);
    expect(plans[1].cutFractions).toEqual([0.4]);
  });

  it('can expose separate footprint-plan controls for each floor', async () => {
    setup({ onSplitByFloorPlans: vi.fn() });

    await userEvent.click(screen.getByText('Edit plans'));
    await userEvent.click(screen.getByLabelText('Use the same floor plan for all floors'));

    expect(screen.getAllByText('Floor 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Floor 2').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Cut 1 percent')).toHaveLength(2);
  });

  it('applies flat eave overhang from reshape controls', async () => {
    const cityjson = buildSampleCube();
    cityjson.CityObjects.Building_A.attributes = {
      ...cityjson.CityObjects.Building_A.attributes,
      _createdBy: 'city-editor-prototype',
      roofType: 'flat',
      _eaveHeight: 10,
      _ridgeHeight: 10,
      _eaveOverhang: 0,
      _rakeOverhang: 0,
    };
    const onReshapeBuilding = vi.fn();
    const { container } = render(
      <AttributePanel
        buildingId="Building_A"
        cityjson={cityjson}
        isDirty={false}
        onAttributeChange={vi.fn()}
        onRevert={vi.fn()}
        onClose={vi.fn()}
        onReshapeBuilding={onReshapeBuilding}
      />
    );

    const eaveInput = container.querySelector(
      'input[title="Flat roof eave overhang in metres"]'
    ) as HTMLInputElement | null;
    expect(eaveInput).not.toBeNull();
    expect(eaveInput!.disabled).toBe(false);

    fireEvent.change(eaveInput!, { target: { value: '0.4' } });
    await userEvent.click(screen.getByText('Apply reshape'));

    expect(onReshapeBuilding).toHaveBeenCalledWith(
      'Building_A',
      expect.objectContaining({ eaveOverhang: 0.4, rakeOverhang: 0 })
    );
  });
});
