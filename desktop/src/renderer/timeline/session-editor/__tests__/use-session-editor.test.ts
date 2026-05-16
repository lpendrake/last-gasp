// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionEditor } from '../use-session-editor';

describe('useSessionEditor', () => {
  it('starts with mode null', () => {
    const { result } = renderHook(() => useSessionEditor());
    expect(result.current.mode).toBeNull();
  });

  it('openCreate sets mode to { kind: "create" } with no prefill', () => {
    const { result } = renderHook(() => useSessionEditor());
    act(() => result.current.openCreate());
    expect(result.current.mode).toEqual({ kind: 'create', prefill: undefined });
  });

  it('openCreate with prefill includes the prefill', () => {
    const { result } = renderHook(() => useSessionEditor());
    const prefill = { inGameStart: '4726-05-04T13:00', inGameEnd: '4726-05-04T17:00' };
    act(() => result.current.openCreate(prefill));
    expect(result.current.mode).toEqual({ kind: 'create', prefill });
  });

  it('openEdit sets mode to { kind: "edit", sessionId }', () => {
    const { result } = renderHook(() => useSessionEditor());
    act(() => result.current.openEdit('session-42'));
    expect(result.current.mode).toEqual({ kind: 'edit', sessionId: 'session-42' });
  });

  it('close resets mode to null', () => {
    const { result } = renderHook(() => useSessionEditor());
    act(() => result.current.openEdit('session-42'));
    act(() => result.current.close());
    expect(result.current.mode).toBeNull();
  });

  it('openEdit overwrites a previous openCreate', () => {
    const { result } = renderHook(() => useSessionEditor());
    act(() => result.current.openCreate());
    act(() => result.current.openEdit('session-x'));
    expect(result.current.mode).toEqual({ kind: 'edit', sessionId: 'session-x' });
  });

  it('openCreate overwrites a previous openEdit', () => {
    const { result } = renderHook(() => useSessionEditor());
    act(() => result.current.openEdit('session-x'));
    act(() => result.current.openCreate());
    expect(result.current.mode?.kind).toBe('create');
  });

  it('returned callbacks are stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useSessionEditor());
    const { openCreate, openEdit, close } = result.current;
    rerender();
    expect(result.current.openCreate).toBe(openCreate);
    expect(result.current.openEdit).toBe(openEdit);
    expect(result.current.close).toBe(close);
  });
});
