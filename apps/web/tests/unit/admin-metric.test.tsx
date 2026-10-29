import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Metric } from '../../src/app/admin/page';

describe('administrator metric card', () => {
  it('renders every supplied metric instead of substituting the operations panel', () => {
    const markup = renderToStaticMarkup(<Metric label="Verified scores" value="42" detail="Server-verified records" tone="sky" />);
    expect(markup).toContain('admin-metric admin-tone-sky');
    expect(markup).toContain('Verified scores');
    expect(markup).toContain('42');
    expect(markup).toContain('Server-verified records');
    expect(markup).not.toContain('admin-operations');
  });
});
