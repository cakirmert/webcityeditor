import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import RoadMapCompare from '../../src/components/RoadMapCompare';

describe('imagery comparison', () => {
  it('restores the chosen opacity after pointer release or cancellation and keyboard comparison', () => {
    const changed = vi.fn();
    function Harness() {
      const [opacity, setOpacity] = useState(.62);
      return <RoadMapCompare basemap="satellite" onBasemapChange={vi.fn()} opacity={opacity} onOpacityChange={value => { changed(value); setOpacity(value); }} />;
    }
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Hold to show imagery only' });
    button.setPointerCapture = vi.fn();
    fireEvent.pointerDown(button, { pointerId: 1 }); expect(changed).toHaveBeenLastCalledWith(0);
    fireEvent.pointerCancel(button); expect(changed).toHaveBeenLastCalledWith(.62);
    fireEvent.pointerDown(button, { pointerId: 2 }); fireEvent.pointerUp(button); expect(changed).toHaveBeenLastCalledWith(.62);
    fireEvent.keyDown(button, { key: ' ' }); expect(changed).toHaveBeenLastCalledWith(0);
    fireEvent.blur(button); expect(changed).toHaveBeenLastCalledWith(.62);
  });
});
