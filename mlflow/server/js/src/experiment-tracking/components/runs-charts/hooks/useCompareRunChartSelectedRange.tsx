import { useMemo, useState } from 'react';
import { findChartStepsByTimestampForRuns } from '../utils/findChartStepsByTimestamp';
import type { SampledMetricsByRunUuidState } from '../../../types';
import { isNumber, isString } from 'lodash';
import { RunsChartsLineChartXAxisType } from '../components/RunsCharts.common';

/**
 * Hook used in compare run charts. It's responsible for converting selected range
 * (which can be either step or timestamp) to step range, based on chart axis type.
 * @param xAxisKey Can be 'step', 'time' or 'time-relative'
 * @param metricKey
 * @param sampledMetricsByRunUuid Recorded history for metrics for runs in compare chart
 * @param runUuids List of run UUIDs in compare chart
 * @param scaleType Scale type for the chart
 */
export const useCompareRunChartSelectedRange = (
  xAxisKey: RunsChartsLineChartXAxisType,
  metricKey: string,
  sampledMetricsByRunUuid: SampledMetricsByRunUuidState,
  runUuids: string[],
  scaleType: 'linear' | 'log' = 'linear',
) => {
  // Zoom-only state, seeded undefined so a stale value can't get "stuck" once the manual range is
  // cleared. The manual/global X range is applied live by the card (effectiveXRange); this holds only
  // the user's transient zoom selection.
  const [xRangeLocal, setXRangeLocal] = useState<[number | string, number | string] | undefined>(undefined);
  const [offsetTimestamp, setOffsetTimestamp] = useState<[number, number] | undefined>(undefined);
  const stepRange = useMemo<[number, number] | undefined>(() => {
    if (!xRangeLocal) {
      return undefined;
    }
    if (xAxisKey === RunsChartsLineChartXAxisType.TIME && isString(xRangeLocal[0]) && isString(xRangeLocal[1])) {
      // If we're dealing with absolute time-based chart axis, find corresponding steps based on timestamp
      const bounds = findChartStepsByTimestampForRuns(
        sampledMetricsByRunUuid,
        runUuids,
        metricKey,
        xRangeLocal as [string, string],
      );
      return bounds;
    }

    if (
      xAxisKey === RunsChartsLineChartXAxisType.TIME_RELATIVE &&
      offsetTimestamp &&
      isNumber(xRangeLocal[0]) &&
      isNumber(xRangeLocal[1])
    ) {
      // If we're dealing with absolute time-based chart axis, find corresponding steps based on timestamp
      const bounds = findChartStepsByTimestampForRuns(
        sampledMetricsByRunUuid,
        runUuids,
        metricKey,
        offsetTimestamp as [number, number],
      );
      return bounds;
    }

    if (xAxisKey === RunsChartsLineChartXAxisType.STEP && isNumber(xRangeLocal[0]) && isNumber(xRangeLocal[1])) {
      // If we're dealing with step-based chart axis, use those steps but incremented/decremented
      const lowerBound = Math.floor(scaleType === 'log' ? 10 ** xRangeLocal[0] : xRangeLocal[0]);
      const upperBound = Math.ceil(scaleType === 'log' ? 10 ** xRangeLocal[1] : xRangeLocal[1]);
      return lowerBound && upperBound ? [lowerBound - 1, upperBound + 1] : undefined;
    }

    // return undefined for xAxisKey === 'metric' because there isn't
    // necessarily a mapping between value range and step range
    return undefined;
  }, [xAxisKey, metricKey, xRangeLocal, sampledMetricsByRunUuid, runUuids, offsetTimestamp, scaleType]);

  return {
    /**
     * If there's an offset timestamp calculated from relative runs, set it using this function
     */
    setOffsetTimestamp,
    /**
     * Resulting step range
     */
    stepRange,
    /**
     * Local range selected by user
     */
    xRangeLocal,
    /**
     * Set selected range
     */
    setXRangeLocal,
  };
};
