import type * as Monaco from "monaco-editor";
import { ESPHomeSchema } from "./esphome-schema";
import { c } from "tar";
import protoInfraUrls from "@extensions/protoinfra/utils/protoInfraUrls";

type MonacoAPI = typeof import("monaco-editor");

const getGlobalMonaco = (): MonacoAPI | undefined => {
  if (typeof globalThis === "undefined") return undefined;
  return (globalThis as any)?.monaco as MonacoAPI | undefined;
};

const fallbackCompletionItemKind = {
  Method: 0,
  Function: 1,
  Constructor: 2,
  Field: 3,
  Variable: 4,
  Class: 5,
  Struct: 6,
  Interface: 7,
  Module: 8,
  Property: 9,
  Event: 10,
  Operator: 11,
  Unit: 12,
  Value: 13,
  Constant: 14,
  Enum: 15,
  EnumMember: 16,
  Keyword: 17,
  Text: 18,
  Color: 19,
  File: 20,
  Reference: 21,
  Customcolor: 22,
  Folder: 23,
  TypeParameter: 24,
  Snippet: 25,
} as const;

const fallbackInsertTextRule = {
  KeepWhitespace: 1,
  InsertAsSnippet: 4,
} as const;

const createProxy = <T extends Record<string, unknown>>(
  fallback: T,
  selector: (monaco: MonacoAPI) => Record<string | symbol, unknown>,
) =>
  new Proxy(fallback, {
    get(target, prop: string | symbol) {
      const monaco = getGlobalMonaco();
      if (monaco) {
        const source = selector(monaco);
        if (prop in source) {
          return source[prop];
        }
      }
      return target[prop as keyof T];
    },
  }) as T;

// Default schema version, minimum is 2025.5.0 as its the oldest that esphome gihub repo still has schema files for.
let schema_version = "2025.11.1";
const fetchSchemaVersion = async () => {
  try {
    const response = await fetch(
      protoInfraUrls.esphome.url + "/api/v1/esphome/version",
    );
    if (response.ok) {
      const data = await response.json();
      const fetchedVersion = data.version;
      // Simple version comparison
      if (fetchedVersion > schema_version) {
        schema_version = fetchedVersion;
      }
    }
  } catch (error) {
    console.warn(
      "Failed to fetch latest ESPHome schema version, using default.",
    );
  }
};
fetchSchemaVersion();

const schema_uri = (name: string, version?: string) =>
  `https://schema.esphome.io/${version || schema_version}/${name}.json`;

export async function setSchemaVersion(version: string) {
  if (version.endsWith("dev")) schema_version = "dev";
  else {
    // check esphome schema exists for given schema
    const response = await fetch(schema_uri("esphome", version));
    if (response.ok) schema_version = version;
    else
      console.warn(
        `Schema version ${version} not available in schema.esphome.io. Using latest dev schemas instead.`,
      );
  }
}

export const coreSchema = new ESPHomeSchema(async (name: string) => {
  const response = await fetch(schema_uri(name));
  const fileContents = await response.text();
  return JSON.parse(fileContents);
});

export const createHover = (contents: string, range: Range) => {
  return {
    range: {
      startLineNumber: range.start.line + 1,
      startColumn: range.start.character + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.character + 1,
    },
    contents: [{ value: contents }],
  };
};

/**
 * Position in a text document expressed as zero-based line and character offset.
 * The offsets are based on a UTF-16 string representation. So a string of the form
 * `a𐐀b` the character offset of the character `a` is 0, the character offset of `𐐀`
 * is 1 and the character offset of b is 3 since `𐐀` is represented using two code
 * units in UTF-16.
 *
 * Positions are line end character agnostic. So you can not specify a position that
 * denotes `\r|\n` or `\n|` where `|` represents the character offset.
 */
export interface Position {
  /**
   * Line position in a document (zero-based).
   */
  line: number;
  /**
   * Character offset on a line in a document (zero-based). Assuming that the line is
   * represented as a string, the `character` value represents the gap between the
   * `character` and `character + 1`.
   *
   * If the character value is greater than the line length it defaults back to the
   * line length.
   */
  character: number;
}

/**
 * A range in a text document expressed as (zero-based) start and end positions.
 *
 * If you want to specify a range that contains a line including the line ending
 * character(s) then use an end position denoting the start of the next line.
 * For example:
 * ```ts
 * {
 *     start: { line: 5, character: 23 }
 *     end : { line 6, character : 0 }
 * }
 * ```
 */
export interface Range {
  /**
   * The range's start position
   */
  start: Position;
  /**
   * The range's end position.
   */
  end: Position;
}

export const fromMonacoPosition = (position: Monaco.Position): Position => ({
  line: position.lineNumber - 1,
  character: position.column - 1,
});

export const toMonacoPosition = (position: Position): Monaco.IPosition => ({
  lineNumber: position.line + 1,
  column: position.character + 1,
});

export type CompletionItem = Monaco.languages.CompletionItem;
export const CompletionItemKind = createProxy(
  fallbackCompletionItemKind,
  (monaco) => monaco.languages.CompletionItemKind,
) as Monaco.languages.CompletionItemKind;
export const CompletionItemInsertTextRule = createProxy(
  fallbackInsertTextRule,
  (monaco) => monaco.languages.CompletionItemInsertTextRule,
) as Monaco.languages.CompletionItemInsertTextRule;

export const createCompletion = (
  label: string,
  insertText: string,
  kind: Monaco.languages.CompletionItemKind,
  documentation: string | undefined = undefined,
  triggerSuggest: boolean = false,
  preselect?: boolean,
  snippet?: boolean,
  sortText?: string,
  detail?: string,
) => {
  const completion: Monaco.languages.CompletionItem = {
    label: label,
    insertText: insertText,
    kind,
    range: null!,
    preselect,
    sortText,
    detail,
  };
  if (triggerSuggest) {
    completion.command = {
      title: "chain",
      id: "editor.action.triggerSuggest",
    };
  }
  // use IMarkdownString
  if (documentation) completion.documentation = { value: documentation };
  if (snippet) {
    completion.insertTextRules = CompletionItemInsertTextRule.InsertAsSnippet;
  }
  return completion;
};

export const createCompletionSnippet = (
  label: string,
  insertText: string,
  kind: Monaco.languages.CompletionItemKind,
  documentation: string | undefined = undefined,
) => {
  const completion: CompletionItem = {
    label: label,
    insertText: insertText,
    kind,
    insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
    documentation,
    range: null!,
  };
  return completion;
};
