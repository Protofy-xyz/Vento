import React from 'react';
import parse, { HTMLReactParserOptions } from 'html-react-parser';
import { Opts } from 'linkifyjs';
import { MessageEmptyContent } from './content';
import { sanitizeCustomHtml } from '../../utils/sanitize';
import { parseBlockMD } from '../../plugins/markdown/block';
import { parseInlineMD } from '../../plugins/markdown/inline';

type RenderBodyProps = {
  body: string;
  customBody?: string;

  highlightRegex?: RegExp;
  htmlReactParserOptions: HTMLReactParserOptions;
  linkifyOpts: Opts;
};

// Regex to match URLs that are not already in markdown link format
const URL_REGEX = /(?<!\]\()(?<!\[)(https?:\/\/[^\s<>\[\]]+?)(?=[.,;:!?\s<>\[\]]|$)/g;

/**
 * Converts plain URLs to markdown link format [url](url)
 * This ensures URLs are clickable after markdown parsing
 */
const linkifyUrls = (text: string): string => {
  return text.replace(URL_REGEX, (url) => `[${url}](${url})`);
};

/**
 * Converts plain text to markdown-rendered HTML.
 * Uses the internal markdown parsers to convert markdown syntax to HTML.
 */
const parseMarkdownToHtml = (text: string): string => {
  // First, convert plain URLs to markdown links
  const textWithLinks = linkifyUrls(text);
  // Parse block-level markdown (headings, code blocks, lists, blockquotes)
  // and inline markdown (bold, italic, code, links, etc.)
  return parseBlockMD(textWithLinks, parseInlineMD);
};

export function RenderBody({
  body,
  customBody,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  highlightRegex,
  htmlReactParserOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  linkifyOpts,
}: RenderBodyProps) {
  if (body === '') <MessageEmptyContent />;
  if (customBody) {
    if (customBody === '') <MessageEmptyContent />;
    return parse(sanitizeCustomHtml(customBody), htmlReactParserOptions);
  }
  
  // Parse the body as markdown and render as HTML
  const parsedHtml = parseMarkdownToHtml(body);
  return parse(sanitizeCustomHtml(parsedHtml), htmlReactParserOptions);
}
