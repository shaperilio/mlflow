import { Input, useDesignSystemTheme } from '@databricks/design-system';
import { useMemo, useRef, useState } from 'react';
import { DEFAULT_LEGEND_LABEL_TEMPLATE } from './RunsCharts.common';

const MAX_SUGGESTIONS = 8;

/**
 * Text input for a legend label template with inline `{`-triggered autocomplete. While the cursor is
 * inside an unclosed `{…`, a list of matching tokens is shown — `run`, `metric`, and a flattened list
 * of `params.<name>` / `tags.<name>` built from the visible runs' keys. Selecting one (click) inserts
 * the full `{token}` at the cursor; the user keeps editing freely.
 *
 * Selection is click-based (not arrow keys) so it coexists with the chart gear DropdownMenu's keyboard
 * handling, and the suggestion list is rendered in-flow so it just grows the dropdown rather than being
 * clipped.
 */
export const RunsChartsLegendTemplateInput = ({
  value,
  onChange,
  paramKeys,
  tagKeys,
  componentId,
  ariaLabel,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  paramKeys: string[];
  tagKeys: string[];
  componentId: string;
  ariaLabel: string;
}) => {
  const { theme } = useDesignSystemTheme();
  // The design-system Input forwards an antd InputRef (exposes focus()/setSelectionRange()), not a raw
  // element, so this is typed loosely (mirrors ExperimentViewRunsColumnSelector's searchInputRef).
  const inputRef = useRef<any>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const allTokens = useMemo(
    () => ['run', 'metric', ...paramKeys.map((key) => `params.${key}`), ...tagKeys.map((key) => `tags.${key}`)],
    [paramKeys, tagKeys],
  );

  const text = value ?? '';

  // The token currently being typed: text from the last unclosed '{' up to the cursor.
  const activeToken = useMemo(() => {
    if (cursor === null) {
      return null;
    }
    const before = text.slice(0, cursor);
    const openIdx = before.lastIndexOf('{');
    if (openIdx === -1 || before.slice(openIdx).includes('}')) {
      return null;
    }
    return { start: openIdx, partial: before.slice(openIdx + 1) };
  }, [text, cursor]);

  const suggestions = useMemo(() => {
    if (!open || !activeToken) {
      return [];
    }
    const partial = activeToken.partial.toLowerCase();
    return allTokens.filter((token) => token.toLowerCase().startsWith(partial)).slice(0, MAX_SUGGESTIONS);
  }, [open, activeToken, allTokens]);

  const insertToken = (token: string) => {
    if (!activeToken) {
      return;
    }
    const end = cursor ?? text.length;
    const after = text.slice(end);
    // Reuse a closing brace that's already there (e.g. when editing an existing token) instead of
    // adding a second one.
    const closing = after.startsWith('}') ? '' : '}';
    const nextValue = `${text.slice(0, activeToken.start)}{${token}${closing}${after}`;
    onChange(nextValue);
    setOpen(false);
    // Restore focus and place the cursor right after the (single) closing brace.
    const newCursor = activeToken.start + token.length + 2;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
        setCursor(newCursor);
      }
    });
  };

  return (
    <div css={{ position: 'relative' }}>
      <Input
        componentId={componentId}
        aria-label={ariaLabel}
        ref={inputRef}
        placeholder={DEFAULT_LEGEND_LABEL_TEMPLATE}
        value={text}
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(e.target.selectionStart);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay hiding so a suggestion's onMouseDown can fire first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        // The gear DropdownMenu's type-ahead grabs letter keys; stop the keydown on the input itself.
        onKeyDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {suggestions.length > 0 && (
        <div
          css={{
            marginTop: theme.spacing.xs,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 4,
            backgroundColor: theme.colors.backgroundPrimary,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((token) => (
            <div
              key={token}
              role="button"
              tabIndex={-1}
              // onMouseDown (not onClick) fires before the input's blur, so the selection registers.
              onMouseDown={(e) => {
                e.preventDefault();
                insertToken(token);
              }}
              css={{
                padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                cursor: 'pointer',
                fontSize: theme.typography.fontSizeSm,
                '&:hover': { backgroundColor: theme.colors.actionTertiaryBackgroundHover },
              }}
            >{`{${token}}`}</div>
          ))}
        </div>
      )}
    </div>
  );
};
