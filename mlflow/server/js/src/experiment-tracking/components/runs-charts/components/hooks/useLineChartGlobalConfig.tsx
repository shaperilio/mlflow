import { isUndefined, pick } from 'lodash';
import type { RunsChartsLineCardConfig } from '../../runs-charts.types';
import type { RunsChartsGlobalLineChartConfig } from '../../../experiment-page/models/ExperimentPageUIState';
import { useMemo } from 'react';
import { RunsChartsLineChartXAxisType } from '../RunsCharts.common';

/**
 * A utility hook that selects if certain line chart settings should be
 * taken from global configuration or from local chard card settings.
 */
export const useLineChartGlobalConfig = (
  originalCardConfig: RunsChartsLineCardConfig,
  globalLineChartConfig?: RunsChartsGlobalLineChartConfig,
) =>
  useMemo(() => {
    const result: Pick<RunsChartsLineCardConfig, 'xAxisKey' | 'selectedXAxisMetricKey' | 'lineSmoothness'> & {
      xRangeMin?: number;
      xRangeMax?: number;
    } = {
      ...pick(originalCardConfig, ['xAxisKey', 'selectedXAxisMetricKey', 'lineSmoothness']),
      // The X range defaults to the chart's own manual range.
      xRangeMin: originalCardConfig.range?.xMin,
      xRangeMax: originalCardConfig.range?.xMax,
    };

    if (!globalLineChartConfig) {
      return result;
    }

    const globalXAxisKey = globalLineChartConfig.xAxisKey;

    if (originalCardConfig.useGlobalLineSmoothing && !isUndefined(globalLineChartConfig.lineSmoothness)) {
      result.lineSmoothness = globalLineChartConfig.lineSmoothness;
    }

    if (!isUndefined(globalXAxisKey) && originalCardConfig.useGlobalXaxisKey) {
      result.xAxisKey = globalXAxisKey;
      const globalSelectedXAxisMetricKey = globalLineChartConfig?.selectedXAxisMetricKey;
      if (globalXAxisKey === RunsChartsLineChartXAxisType.METRIC && globalSelectedXAxisMetricKey) {
        result.selectedXAxisMetricKey = globalSelectedXAxisMetricKey;
      }
      // When the chart defers its X axis to workspace settings, also take the global manual range.
      if (!isUndefined(globalLineChartConfig.xRangeMin) || !isUndefined(globalLineChartConfig.xRangeMax)) {
        result.xRangeMin = globalLineChartConfig.xRangeMin;
        result.xRangeMax = globalLineChartConfig.xRangeMax;
      }
    }

    return result;
  }, [originalCardConfig, globalLineChartConfig]);
