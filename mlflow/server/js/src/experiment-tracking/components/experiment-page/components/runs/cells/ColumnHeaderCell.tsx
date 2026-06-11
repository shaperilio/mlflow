import { SortAscendingIcon, SortDescendingIcon, useDesignSystemTheme } from '@databricks/design-system';
import { useUpdateExperimentPageSearchFacets } from '../../../hooks/useExperimentPageSearchFacets';

export interface ColumnHeaderCellProps {
  enableSorting: boolean;
  displayName: string;
  canonicalSortKey: string;
  context: {
    orderByKey: string;
    orderByAsc: boolean;
    clientSort?: { colId: string; asc: boolean } | null;
    setClientSort?: (sort: { colId: string; asc: boolean } | null) => void;
  };
  /** Optional scale annotation shown below the column name, e.g. "×10⁻⁶" */
  headerAnnotation?: string;
  /** When true, this column sorts client-side (numeric param) rather than via the server. */
  clientSortable?: boolean;
}

export const ColumnHeaderCell = ({
  enableSorting,
  canonicalSortKey,
  displayName,
  context: tableContext,
  headerAnnotation,
  clientSortable,
}: ColumnHeaderCellProps) => {
  const { orderByKey, orderByAsc, clientSort, setClientSort } = tableContext || {};
  const updateSearchFacets = useUpdateExperimentPageSearchFacets();
  const selectedCanonicalSortKey = canonicalSortKey;

  // This column is the active client-side (numeric param) sort.
  const isActiveClientSort = Boolean(clientSortable && clientSort?.colId === canonicalSortKey);
  // This column is the active server sort (suppressed while a client sort overrides the order).
  const isActiveServerSort = !clientSort && selectedCanonicalSortKey === orderByKey;
  const isOrdered = isActiveClientSort || isActiveServerSort;
  const ascending = isActiveClientSort ? Boolean(clientSort?.asc) : orderByAsc;

  const handleSortBy = () => {
    if (clientSortable) {
      // Client-side sort: a new column starts ascending, clicking the same column toggles
      // asc <-> desc (binary, no "off" state). Never touches the search facets, so no re-fetch.
      if (clientSort && clientSort.colId === canonicalSortKey) {
        setClientSort?.({ colId: canonicalSortKey, asc: !clientSort.asc });
      } else {
        setClientSort?.({ colId: canonicalSortKey, asc: true });
      }
      return;
    }
    // Server-side sort: clear any active client sort, then update the search facets.
    setClientSort?.(null);
    let newOrderByAsc = !orderByAsc;
    // If the new sortKey is not equal to the previous sortKey, reset the orderByAsc
    if (selectedCanonicalSortKey !== orderByKey) {
      newOrderByAsc = false;
    }
    updateSearchFacets({ orderByKey: selectedCanonicalSortKey, orderByAsc: newOrderByAsc });
  };

  const { theme } = useDesignSystemTheme();
  const isOrderedByClassName = 'is-ordered-by';

  return (
    <div
      role="columnheader"
      css={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div
        css={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          paddingLeft: theme.spacing.xs + theme.spacing.sm,
          paddingRight: theme.spacing.xs + theme.spacing.sm,
          paddingTop: theme.spacing.xs,
          paddingBottom: theme.spacing.xs,
          gap: theme.spacing.sm,
          svg: {
            color: theme.colors.textSecondary,
          },
          '&:hover': {
            color: enableSorting ? theme.colors.actionTertiaryTextHover : 'unset',
            svg: {
              color: theme.colors.actionTertiaryTextHover,
            },
          },
        }}
        className={isOrdered ? isOrderedByClassName : ''}
        onClick={enableSorting ? handleSortBy : undefined}
      >
        <div css={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div css={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing.sm }}>
            <span
              data-testid={`sort-header-${displayName}`}
              css={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}
            >
              {displayName}
            </span>
            {enableSorting && isOrdered ? ascending ? <SortAscendingIcon /> : <SortDescendingIcon /> : null}
          </div>
          {headerAnnotation && (
            <span
              css={{
                fontSize: 10,
                lineHeight: 1,
                color: theme.colors.textSecondary,
                whiteSpace: 'nowrap',
              }}
            >
              {headerAnnotation}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
