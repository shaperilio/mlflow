import { useCallback, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import type { ReduxState } from '../../../../../redux-types';
import type { MetricHistoryByName } from '../../../../types';
import {
  RunsChartsLineChartXAxisType,
  removeOutliersFromMetricHistory,
  resolveManualYRange,
  type RunsChartsRunData,
} from '../RunsCharts.common';
import { RunsMetricsLinePlot } from '../RunsMetricsLinePlot';
import { RunsChartsTooltipMode, useRunsChartsTooltip } from '../../hooks/useRunsChartsTooltip';
import type { RunsChartsLineCardConfig } from '../../runs-charts.types';
import { RunsChartsLineChartYAxisType } from '../../runs-charts.types';
import { shouldEnableChartExpressions } from '../../../../../common/utils/FeatureUtils';
import { useSampledMetricHistory } from '../../hooks/useSampledMetricHistory';
import { compact, isUndefined, uniq } from 'lodash';
import type { RunsGroupByConfig } from '../../../experiment-page/utils/experimentPage.group-row-utils';
import { useGroupedChartRunData } from '../../../runs-compare/hooks/useGroupedChartRunData';
import type { RunsChartsGlobalLineChartConfig } from '../../../experiment-page/models/ExperimentPageUIState';
import { useLineChartGlobalConfig } from '../hooks/useLineChartGlobalConfig';
import { RunsChartCardLoadingPlaceholder } from '../cards/ChartCard.common';

const RunsChartsConfigureLineChartPreviewImpl = ({
  previewData,
  cardConfig,
  metricsByRunUuid,
  groupBy,
  globalLineChartConfig,
}: {
  previewData: RunsChartsRunData[];
  cardConfig: RunsChartsLineCardConfig;
  groupBy: RunsGroupByConfig | null;

  globalLineChartConfig?: RunsChartsGlobalLineChartConfig;

  metricsByRunUuid: Record<string, MetricHistoryByName>;
}) => {
  const { lineSmoothness, selectedXAxisMetricKey, xAxisKey } = useLineChartGlobalConfig(
    cardConfig,
    globalLineChartConfig,
  );

  const isGrouped = useMemo(() => previewData.some((r) => r.groupParentInfo), [previewData]);

  const { aggregateFunction } = groupBy || {};

  const runUuidsToFetch = useMemo(() => {
    if (isGrouped) {
      const runsInGroups = compact(previewData.map((r) => r.groupParentInfo)).flatMap((g) => g.runUuids);
      const ungroupedRuns = compact(
        previewData.filter((r) => !r.groupParentInfo && !r.belongsToGroup).map((r) => r.runInfo?.runUuid ?? undefined),
      );
      return [...runsInGroups, ...ungroupedRuns];
    }
    return compact(previewData.map((r) => r.runInfo)).map((g) => g.runUuid ?? '');
  }, [previewData, isGrouped]);

  const metricKeysToFetch = useMemo(() => {
    const getYAxisKeys = (cardConfig: RunsChartsLineCardConfig) => {
      const fallback = [cardConfig.metricKey];
      if (!shouldEnableChartExpressions() || cardConfig.yAxisKey !== RunsChartsLineChartYAxisType.EXPRESSION) {
        return cardConfig.selectedMetricKeys ?? fallback;
      }
      const yAxisKeys = cardConfig.yAxisExpressions?.reduce((acc, exp) => {
        exp.variables.forEach((variable) => acc.add(variable));
        return acc;
      }, new Set<string>());
      return yAxisKeys === undefined ? fallback : Array.from(yAxisKeys);
    };
    const yAxisKeys = getYAxisKeys(cardConfig);
    const xAxisKeys = !selectedXAxisMetricKey ? [] : [selectedXAxisMetricKey];
    const rightAxisKeys = cardConfig.showSecondYAxis ? cardConfig.selectedMetricKeysRight ?? [] : [];
    return uniq(yAxisKeys.concat(xAxisKeys, rightAxisKeys));
  }, [cardConfig, selectedXAxisMetricKey]);

  const { resultsByRunUuid, isLoading } = useSampledMetricHistory({
    runUuids: runUuidsToFetch,
    metricKeys: metricKeysToFetch,
    enabled: true,
    maxResults: 320,
    autoRefreshEnabled: false,
  });

  const sampledData = useMemo(() => {
    // Right-axis metrics use their own ignore-outliers setting; everything else uses the left axis's.
    const rightKeys = new Set(cardConfig.showSecondYAxis ? cardConfig.selectedMetricKeysRight ?? [] : []);
    return previewData.map((run) => {
      const metricsHistory = metricKeysToFetch.reduce((acc: MetricHistoryByName, key) => {
        const history = resultsByRunUuid[run.uuid]?.[key]?.metricsHistory;
        if (history) {
          const ignoreOutliers = rightKeys.has(key) ? cardConfig.ignoreOutliersRight : cardConfig.ignoreOutliers;
          acc[key] = ignoreOutliers ? removeOutliersFromMetricHistory(history) : history;
        }
        return acc;
      }, {});

      return {
        ...run,
        metricsHistory,
      };
    });
  }, [
    metricKeysToFetch,
    resultsByRunUuid,
    previewData,
    cardConfig.ignoreOutliers,
    cardConfig.ignoreOutliersRight,
    cardConfig.showSecondYAxis,
    cardConfig.selectedMetricKeysRight,
  ]);

  const sampledGroupData = useGroupedChartRunData({
    enabled: isGrouped,
    ungroupedRunsData: sampledData,
    metricKeys: metricKeysToFetch,
    sampledDataResultsByRunUuid: resultsByRunUuid,
    aggregateFunction,
    selectedXAxisMetricKey: xAxisKey === RunsChartsLineChartXAxisType.METRIC ? selectedXAxisMetricKey : undefined,
    ignoreOutliers: cardConfig.ignoreOutliers ?? false,
  });

  // Use grouped data traces only if enabled and if there are any groups
  const chartData = isGrouped ? sampledGroupData : sampledData;

  // Resolve a one-sided manual Y range to a concrete [min, max] from the data (the plot just gets a
  // fixed range). Memoized so it only re-scans when the sampled data or the range inputs change.
  const yRange = useMemo(
    () =>
      resolveManualYRange(
        chartData,
        cardConfig.selectedMetricKeys ?? [cardConfig.metricKey],
        cardConfig.range?.yMin,
        cardConfig.range?.yMax,
        cardConfig.scaleType === 'log',
      ),
    [
      chartData,
      cardConfig.selectedMetricKeys,
      cardConfig.metricKey,
      cardConfig.range?.yMin,
      cardConfig.range?.yMax,
      cardConfig.scaleType,
    ],
  );
  const resolvedRangeRight = useMemo(() => {
    if (!cardConfig.showSecondYAxis) {
      return undefined;
    }
    const resolved = resolveManualYRange(
      chartData,
      cardConfig.selectedMetricKeysRight ?? [],
      cardConfig.rangeRight?.yMin,
      cardConfig.rangeRight?.yMax,
      cardConfig.scaleTypeRight === 'log',
    );
    return resolved ? { yMin: resolved[0], yMax: resolved[1] } : undefined;
  }, [
    chartData,
    cardConfig.showSecondYAxis,
    cardConfig.selectedMetricKeysRight,
    cardConfig.rangeRight?.yMin,
    cardConfig.rangeRight?.yMax,
    cardConfig.scaleTypeRight,
  ]);

  const { setTooltip, resetTooltip } = useRunsChartsTooltip(
    cardConfig,
    RunsChartsTooltipMode.MultipleTracesWithScanline,
  );

  if (isLoading) {
    return <RunsChartCardLoadingPlaceholder />;
  }

  const checkValidRange = (
    rangeMin: number | undefined,
    rangeMax: number | undefined,
  ): [number, number] | undefined => {
    if (isUndefined(rangeMin) || isUndefined(rangeMax)) {
      return undefined;
    }
    return [rangeMin, rangeMax];
  };

  const xRange = checkValidRange(cardConfig.range?.xMin, cardConfig.range?.xMax);

  return (
    <RunsMetricsLinePlot
      runsData={chartData}
      metricKey={cardConfig.metricKey}
      selectedMetricKeys={cardConfig.selectedMetricKeys}
      scaleType={cardConfig.scaleType}
      xAxisScaleType={cardConfig.xAxisScaleType}
      lineSmoothness={lineSmoothness}
      xAxisKey={xAxisKey}
      selectedXAxisMetricKey={selectedXAxisMetricKey}
      displayPoints={cardConfig.displayPoints}
      yAxisExpressions={cardConfig.yAxisExpressions}
      yAxisKey={cardConfig.yAxisKey}
      showSecondYAxis={cardConfig.showSecondYAxis}
      selectedMetricKeysRight={cardConfig.selectedMetricKeysRight}
      scaleTypeRight={cardConfig.scaleTypeRight}
      rangeRight={resolvedRangeRight}
      useDefaultHoverBox={false}
      onHover={setTooltip}
      onUnhover={resetTooltip}
      xRange={xRange}
      yRange={yRange}
    />
  );
};

const mapStateToProps = ({ entities: { metricsByRunUuid } }: ReduxState) => ({
  metricsByRunUuid,
});

/**
 * Preview of line chart used in compare runs configuration modal
 */
export const RunsChartsConfigureLineChartPreview = connect(mapStateToProps, undefined, undefined, {
  areStatesEqual: (nextState, prevState) => nextState.entities.metricsByRunUuid === prevState.entities.metricsByRunUuid,
})(RunsChartsConfigureLineChartPreviewImpl);
