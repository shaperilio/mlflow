import {
  Button,
  ChevronLeftIcon,
  ChevronRightIcon,
  TitleSkeleton,
  useDesignSystemTheme,
} from '@databricks/design-system';
import { useLocalStorage } from '@databricks/web-shared/hooks';
import { ExperimentPageTabName } from '../../../constants';
import { ExperimentKind } from '../../../constants';
import { useExperimentEvaluationRunsData } from '../../../components/experiment-page/hooks/useExperimentEvaluationRunsData';
import type { ExperimentPageSideNavSectionKey } from './constants';
import { COLLAPSED_CLASS_NAME, FULL_WIDTH_CLASS_NAME, useExperimentPageSideNavConfig } from './constants';
import { ExperimentPageSideNavSection } from './ExperimentPageSideNavSection';
import { ExperimentPageSideNavAssistantButton } from './ExperimentPageSideNavAssistantButton';
import { useParams } from '@mlflow/mlflow/src/common/utils/RoutingUtils';

const SIDE_NAV_WIDTH = 160;
const SIDE_NAV_COLLAPSED_WIDTH = 32;

/**
 * Hover-revealed chevron that hides/shows the side nav, mirroring the run-list collapse
 * (ExperimentViewRunsTableResizerHandle). Stays fully visible while hidden so the nav can be re-opened.
 */
const ExperimentPageSideNavCollapseHandle = ({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) => {
  const { theme } = useDesignSystemTheme();

  return (
    <div
      css={{
        width: 0,
        overflow: 'visible',
        height: '100%',
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 10,
        display: 'flex',
        opacity: hidden ? 1 : 0,
        transition: 'opacity 0.2s',
        '&:hover': {
          opacity: 1,
          '.button': { border: `2px solid ${theme.colors.actionDefaultBorderHover}` },
        },
      }}
    >
      {/* Edge strip: provides the hover target that reveals the button when the nav is shown. */}
      <div
        css={{
          position: 'absolute',
          left: -theme.general.iconSize / 2,
          width: theme.general.iconSize,
          height: '100%',
          top: 0,
        }}
      >
        <div
          className="button"
          css={{
            top: '50%',
            transition: 'border-color 0.2s',
            position: 'absolute',
            width: theme.general.iconSize,
            height: theme.general.iconSize,
            backgroundColor: theme.colors.backgroundPrimary,
            borderRadius: theme.general.iconSize,
            overflow: 'hidden',
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 11,
          }}
        >
          <Button
            componentId="mlflow.experiment_page.side_nav.collapse"
            onClick={onToggle}
            icon={hidden ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            size="small"
            aria-label={hidden ? 'Show navigation' : 'Hide navigation'}
          />
        </div>
      </div>
    </div>
  );
};

export const ExperimentPageSideNav = ({
  experimentKind,
  activeTab,
}: {
  experimentKind: ExperimentKind;
  activeTab: ExperimentPageTabName;
}) => {
  const { theme } = useDesignSystemTheme();
  const { experimentId } = useParams();
  // the single chat session tab also has a sidebar. to conserve
  // horizontal space, we force the side nav to be collapsed in this tab
  const forceCollapsed = activeTab === ExperimentPageTabName.SingleChatSession;

  // User-controlled hide (persisted), mirroring the run list's collapse. When hidden the panel
  // takes no width and only the re-expand chevron remains.
  const [hidden, setHidden] = useLocalStorage({
    key: 'mlflow.experiment-page-side-nav-hidden',
    version: 1,
    initialValue: false,
  });

  const isGenAIExperiment =
    experimentKind === ExperimentKind.GENAI_DEVELOPMENT || experimentKind === ExperimentKind.GENAI_DEVELOPMENT_INFERRED;

  const { trainingRuns } = useExperimentEvaluationRunsData({
    experimentId: experimentId || '',
    enabled: isGenAIExperiment,
    filter: '', // not important in this case, we show the runs tab if there are any training runs
  });

  const hasTrainingRuns = trainingRuns?.length > 0;

  const sideNavConfig = useExperimentPageSideNavConfig({
    experimentKind,
    hasTrainingRuns,
  });

  return (
    <div css={{ position: 'relative', display: 'flex' }}>
      {!hidden && (
        <div
          css={{
            display: 'flex',
            flexDirection: 'column',
            paddingTop: theme.spacing.sm,
            paddingRight: theme.spacing.sm,
            borderRight: `1px solid ${theme.colors.border}`,
            boxSizing: 'content-box',
            width: SIDE_NAV_COLLAPSED_WIDTH,
            [`& .${COLLAPSED_CLASS_NAME}`]: {
              display: 'flex',
            },
            [`& .${FULL_WIDTH_CLASS_NAME}`]: {
              display: 'none',
            },
            ...(!forceCollapsed
              ? {
                  [theme.responsive.mediaQueries.xl]: {
                    width: SIDE_NAV_WIDTH,
                    [`& .${COLLAPSED_CLASS_NAME}`]: {
                      display: 'none',
                    },
                    [`& .${FULL_WIDTH_CLASS_NAME}`]: {
                      display: 'flex',
                    },
                  },
                }
              : {}),
          }}
        >
          <div css={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <div>
              {Object.entries(sideNavConfig).map(([sectionKey, items]) => (
                <ExperimentPageSideNavSection
                  key={sectionKey}
                  activeTab={activeTab}
                  sectionKey={sectionKey as ExperimentPageSideNavSectionKey}
                  items={items}
                />
              ))}
            </div>
            <ExperimentPageSideNavAssistantButton />
          </div>
        </div>
      )}
      <ExperimentPageSideNavCollapseHandle hidden={hidden} onToggle={() => setHidden((isHidden) => !isHidden)} />
    </div>
  );
};

export const ExperimentPageSideNavSkeleton = () => {
  const { theme } = useDesignSystemTheme();
  return (
    <div
      css={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: theme.spacing.sm,
        paddingRight: theme.spacing.sm,
        borderRight: `1px solid ${theme.colors.border}`,
        width: SIDE_NAV_COLLAPSED_WIDTH,
        [theme.responsive.mediaQueries.xl]: {
          width: SIDE_NAV_WIDTH,
        },
      }}
    >
      <TitleSkeleton css={{ width: '60%' }} />
      <TitleSkeleton css={{ width: '80%' }} />
      <TitleSkeleton css={{ width: '70%' }} />
    </div>
  );
};
