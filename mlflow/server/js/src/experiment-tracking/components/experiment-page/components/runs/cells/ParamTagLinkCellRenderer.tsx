import React from 'react';
import { isHttpUrl } from '../../../../../../common/components/LinkifiedText';

const LINKS_PREFIX = 'links/';

/**
 * Cell renderer for parameter and tag columns. When the value is an http(s) URL it renders a link that
 * opens in a new tab; for a "links/<label>" column the link text is the label (prefix stripped) rather
 * than the raw URL. Non-URL values fall back to the formatted/plain value.
 */
// eslint-disable-next-line react-component-name/react-component-name -- TODO(FEINF-4716)
export const ParamTagLinkCellRenderer = React.memo(
  ({ value, valueFormatted, columnKey }: { value?: string; valueFormatted?: string; columnKey?: string }) => {
    if (typeof value === 'string' && isHttpUrl(value)) {
      const label = columnKey?.startsWith(LINKS_PREFIX) ? columnKey.slice(LINKS_PREFIX.length) : value;
      return (
        <a href={value} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    return <>{valueFormatted ?? value ?? ''}</>;
  },
);
