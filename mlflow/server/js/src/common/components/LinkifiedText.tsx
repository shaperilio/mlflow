import React from 'react';

// Matches http:// or https:// URLs up to the next whitespace. Deliberately limited to explicit
// schemes so we don't turn ambiguous values (e.g. "ghcr.io/org/img:tag", "model.v2") into links.
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// Trailing characters that are almost always punctuation around a URL rather than part of it.
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/**
 * Renders a string, turning any http(s) URLs it contains into links that open in a new tab. Used for
 * parameter and tag values so URL-like values are clickable wherever they're displayed.
 */
export const LinkifiedText = ({ text }: { text: string }): JSX.Element => {
  // Split on the URL pattern; because the regex has a capturing group, the URLs are kept in the result
  // at odd indices, with the surrounding plain text at even indices.
  const parts = (text ?? '').split(URL_REGEX);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          return <React.Fragment key={index}>{part}</React.Fragment>;
        }
        const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? '';
        const url = trailing ? part.slice(0, part.length - trailing.length) : part;
        return (
          <React.Fragment key={index}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
            {trailing}
          </React.Fragment>
        );
      })}
    </>
  );
};
