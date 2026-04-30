import { Switch, Typography, useDesignSystemTheme } from '@databricks/design-system';
import { FormattedMessage, useIntl } from '@databricks/i18n';
import { useLocalStorage } from '../shared/web-shared/hooks';
import { TELEMETRY_ENABLED_STORAGE_KEY, TELEMETRY_ENABLED_STORAGE_VERSION } from '../telemetry/utils';
import { telemetryClient } from '../telemetry';
import { useCallback } from 'react';
import {
  SMART_NUMBER_FORMATTING_KEY,
  SMART_NUMBER_FORMATTING_VERSION,
} from '../experiment-tracking/components/experiment-page/utils/useSmartNumberFormatting';

const SettingsPage = () => {
  const { theme } = useDesignSystemTheme();
  const intl = useIntl();

  const [isSmartFormattingEnabled, setIsSmartFormattingEnabled] = useLocalStorage({
    key: SMART_NUMBER_FORMATTING_KEY,
    version: SMART_NUMBER_FORMATTING_VERSION,
    initialValue: true,
  });

  const [isTelemetryEnabled, setIsTelemetryEnabled] = useLocalStorage({
    key: TELEMETRY_ENABLED_STORAGE_KEY,
    version: TELEMETRY_ENABLED_STORAGE_VERSION,
    initialValue: true,
  });

  const handleTelemetryToggle = useCallback(
    (checked: boolean) => {
      setIsTelemetryEnabled(checked);
      if (checked) {
        telemetryClient.start();
      } else {
        telemetryClient.shutdown();
      }
    },
    [setIsTelemetryEnabled],
  );

  return (
    <div css={{ padding: theme.spacing.md }}>
      <Typography.Title level={2}>
        <FormattedMessage defaultMessage="Settings" description="Settings page title" />
      </Typography.Title>

      <div
        css={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 600,
          marginBottom: theme.spacing.lg,
        }}
      >
        <div css={{ display: 'flex', flexDirection: 'column', marginRight: theme.spacing.lg }}>
          <Typography.Title level={4}>
            <FormattedMessage
              defaultMessage="Smart number formatting"
              description="Smart number formatting settings title"
            />
          </Typography.Title>
          <Typography.Text>
            <FormattedMessage
              defaultMessage="Format metric and parameter values column-aware, with consistent decimal places and space-grouped digits."
              description="Smart number formatting settings description"
            />
          </Typography.Text>
        </div>
        <Switch
          componentId="mlflow.settings.smartNumberFormatting.toggle-switch"
          checked={isSmartFormattingEnabled ?? true}
          onChange={setIsSmartFormattingEnabled}
          label=" "
          activeLabel={intl.formatMessage({
            defaultMessage: 'On',
            description: 'Smart number formatting enabled label',
          })}
          inactiveLabel={intl.formatMessage({
            defaultMessage: 'Off',
            description: 'Smart number formatting disabled label',
          })}
        />
      </div>

      <div css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 600 }}>
        <div css={{ display: 'flex', flexDirection: 'column', marginRight: theme.spacing.lg }}>
          <Typography.Title level={4}>
            <FormattedMessage defaultMessage="Enable telemetry" description="Enable telemetry settings title" />
          </Typography.Title>
          <Typography.Text>
            <FormattedMessage
              defaultMessage="This setting enables UI telemetry data collection. Learn more about what types of data are collected in our {documentation}."
              description="Enable telemetry settings description"
              values={{
                documentation: (
                  <Typography.Link
                    componentId="mlflow.settings.telemetry.documentation-link"
                    href="https://mlflow.org/docs/latest/community/usage-tracking.html"
                    openInNewTab
                  >
                    <FormattedMessage defaultMessage="documentation" description="Documentation link text" />
                  </Typography.Link>
                ),
              }}
            />
          </Typography.Text>
        </div>
        <Switch
          componentId="mlflow.settings.telemetry.toggle-switch"
          checked={isTelemetryEnabled}
          onChange={handleTelemetryToggle}
          label=" "
          activeLabel={intl.formatMessage({ defaultMessage: 'On', description: 'Telemetry enabled label' })}
          inactiveLabel={intl.formatMessage({ defaultMessage: 'Off', description: 'Telemetry disabled label' })}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
