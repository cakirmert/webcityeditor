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
});
