import { Button, NewWindowIcon, Typography, useDesignSystemTheme } from '@databricks/design-system';
import { values } from 'lodash';
import { useMemo } from 'react';
import { FormattedMessage } from 'react-intl';
import type { KeyValueEntity } from '../../../../common/types';
import { isHttpUrl } from '../../../../common/components/LinkifiedText';

const LINKS_PREFIX = 'links/';

/**
 * Renders a row of buttons for any parameter or tag named "links/<label>" whose value is an http(s)
 * URL. Each button is labelled with <label> (the prefix stripped) and opens the URL in a new tab.
 * Shown on the run overview between the description and the metrics/params tables.
 */
export const RunViewLinksBox = ({
  params,
  tags,
}: {
  params: Record<string, KeyValueEntity>;
  tags: Record<string, KeyValueEntity>;
}) => {
  const { theme } = useDesignSystemTheme();

  const links = useMemo(
    () =>
      [...values(params), ...values(tags)]
        .filter(({ key, value }) => key.startsWith(LINKS_PREFIX) && isHttpUrl(value))
        .map(({ key, value }) => ({ label: key.slice(LINKS_PREFIX.length), url: value })),
    [params, tags],
  );

  if (!links.length) {
    return null;
  }

  return (
    <div css={{ marginBottom: theme.spacing.md }}>
      <Typography.Title level={4}>
        <FormattedMessage defaultMessage="Links" description="Run page > Overview > Links section title" />
      </Typography.Title>
      <div css={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {links.map(({ label, url }) => (
          <Button
            key={`${label}-${url}`}
            componentId="mlflow.run_details.overview.links_box.link"
            icon={<NewWindowIcon />}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
};
