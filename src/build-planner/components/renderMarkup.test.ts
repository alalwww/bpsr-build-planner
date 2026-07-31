import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderMarkup } from './renderMarkup';

function asElement(node: unknown): ReactElement {
  return node as ReactElement;
}

describe('renderMarkup', () => {
  it('strips <linktext> to plain content when no handlers are given', () => {
    const result = renderMarkup('前<linktext=1090>激情</linktext>後');
    expect(result).toEqual(['前', '激情', '後']);
  });

  it('renders <linktext> as a clickable span when handlers are given', () => {
    const calls: number[] = [];
    const handlers = {
      isOpen: () => false,
      onClick: (id: number) => calls.push(id),
      onMouseEnter: () => {},
      onMouseLeave: () => {},
    };
    const result = renderMarkup('前<linktext=1090>激情</linktext>後', handlers);

    expect(result).toHaveLength(3);
    const span = asElement(result[1]);
    expect(span.type).toBe('span');
    const props = span.props as { className: string; onClick: (e: { stopPropagation: () => void }) => void };
    expect(props.className).toContain('skill-markup--linktext');

    props.onClick({ stopPropagation: () => {} });
    expect(calls).toEqual([1090]);
  });

  it('marks the currently-open linktext with the --linktext-open modifier class', () => {
    const handlers = {
      isOpen: (id: number) => id === 1090,
      onClick: () => {},
      onMouseEnter: () => {},
      onMouseLeave: () => {},
    };
    const result = renderMarkup('<linktext=1090>激情</linktext>', handlers);
    const span = asElement(result[0]);
    expect((span.props as { className: string }).className).toContain(
      'skill-markup--linktext-open',
    );
  });

  it('recurses into <linktext> content so nested <style> markup still renders', () => {
    const handlers = {
      isOpen: () => false,
      onClick: () => {},
      onMouseEnter: () => {},
      onMouseLeave: () => {},
    };
    const result = renderMarkup(
      '<linktext=3020><style="accent-gn">状態異常</style></linktext>',
      handlers,
    );
    const span = asElement(result[0]);
    const inner = asElement((span.props as { children: unknown[] }).children[0]);
    expect(inner.type).toBe('span');
    expect((inner.props as { className: string }).className).toBe('skill-markup--accent-gn');
  });

  it('still renders <br>/<i>/<style> as before', () => {
    const result = renderMarkup('a<br>b<i>c</i><style="accent-gn">d</style>');
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('a');
    expect(asElement(result[1]).type).toBe('br');
    expect(result[2]).toBe('b');
    expect(asElement(result[3]).type).toBe('em');
    expect(asElement(result[4]).type).toBe('span');
  });
});
