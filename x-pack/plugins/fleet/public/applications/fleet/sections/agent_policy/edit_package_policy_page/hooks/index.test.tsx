/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act } from '@testing-library/react-hooks';

import { createFleetTestRendererMock } from '../../../../../../mock';

import { useHistoryBlock } from '.';

describe('useHistoryBlock', () => {
  describe('without search params', () => {
    it('should not block if not edited', () => {
      const renderer = createFleetTestRendererMock();

      renderer.renderHook(() => useHistoryBlock(false));

      act(() => renderer.mountHistory.push('/test'));

      const { location } = renderer.mountHistory;
      expect(location.pathname).toBe('/test');
      expect(location.search).toBe('');
      expect(renderer.startServices.overlays.openConfirm).not.toBeCalled();
    });

    it('should block if edited', async () => {
      const renderer = createFleetTestRendererMock();

      renderer.startServices.overlays.openConfirm.mockResolvedValue(true);
      renderer.renderHook(() => useHistoryBlock(true));

      act(() => renderer.mountHistory.push('/test'));
      // needed because we have an async useEffect
      await act(() => new Promise((resolve) => resolve()));

      expect(renderer.startServices.overlays.openConfirm).toBeCalled();
      expect(renderer.startServices.application.navigateToUrl).toBeCalledWith(
        '/mock/test',
        expect.anything()
      );
    });

    it('should block if edited and not navigate on cancel', async () => {
      const renderer = createFleetTestRendererMock();

      renderer.startServices.overlays.openConfirm.mockResolvedValue(false);
      renderer.renderHook(() => useHistoryBlock(true));

      act(() => renderer.mountHistory.push('/test'));
      // needed because we have an async useEffect
      await act(() => new Promise((resolve) => resolve()));

      expect(renderer.startServices.overlays.openConfirm).toBeCalled();
      expect(renderer.startServices.application.navigateToUrl).not.toBeCalled();
    });
  });
  describe('with search params', () => {
    it('should not block if not edited', () => {
      const renderer = createFleetTestRendererMock();

      renderer.renderHook(() => useHistoryBlock(false));

      act(() => renderer.mountHistory.push('/test?param=test'));

      const { location } = renderer.mountHistory;
      expect(location.pathname).toBe('/test');
      expect(location.search).toBe('?param=test');
      expect(renderer.startServices.overlays.openConfirm).not.toBeCalled();
    });

    it('should block if edited and navigate on confirm', async () => {
      const renderer = createFleetTestRendererMock();

      renderer.startServices.overlays.openConfirm.mockResolvedValue(true);
      renderer.renderHook(() => useHistoryBlock(true));

      act(() => renderer.mountHistory.push('/test?param=test'));
      // needed because we have an async useEffect
      await act(() => new Promise((resolve) => resolve()));

      expect(renderer.startServices.overlays.openConfirm).toBeCalled();
      expect(renderer.startServices.application.navigateToUrl).toBeCalledWith(
        '/mock/test?param=test',
        expect.anything()
      );
    });

    it('should block if edited and not navigate on cancel', async () => {
      const renderer = createFleetTestRendererMock();

      renderer.startServices.overlays.openConfirm.mockResolvedValue(false);
      renderer.renderHook(() => useHistoryBlock(true));

      act(() => renderer.mountHistory.push('/test?param=test'));
      // needed because we have an async useEffect
      await act(() => new Promise((resolve) => resolve()));

      expect(renderer.startServices.overlays.openConfirm).toBeCalled();
      expect(renderer.startServices.application.navigateToUrl).not.toBeCalled();
    });
  });
});
