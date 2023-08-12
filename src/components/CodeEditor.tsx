import N3 from 'n3';
import type { ViewerProps } from "./Object";
import Editor from '@monaco-editor/react';
import { useMemo, useState } from "react";
import { getProperty, MOON_CODE_LANGUAGE, XSD_STRING } from "../common/util";

import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

function useLanguage(p: ViewerProps) {
  const language = useMemo(() => {
    if ( p.property ) {
      const l = getProperty(p.property.graph, p.property.shape, MOON_CODE_LANGUAGE, { literal: true, expectedType: XSD_STRING})
      if ( l === null ) return undefined;
      return l
    } else return undefined;
  }, [p.property?.shape])
  return language
}

export function CodeEditor(p: ViewerProps) {
  const language = useLanguage(p)

  function onChange(value?: string) {
    if ( value !== undefined && p.onChange ) {
      p.onChange(N3.DataFactory.literal(value))
    }
  }

  return <Editor height="10em"
    onChange={onChange}
    defaultLanguage={language}
    defaultValue={p.term?.value || ""}/>
}

export function CodeViewer(p: ViewerProps) {
  const language = useLanguage(p)
  return <SyntaxHighlighter style={docco}
    language={language}>{p.term?.value || ""}</SyntaxHighlighter>
}
