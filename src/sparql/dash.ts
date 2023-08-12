import { DASH_VIEWER, DASH_EDITOR, RDF_HTML, XSD_ANYURI, XSD_STRING, RDF_LANG_STRING, MOON_BASE, SHACL_DATATYPE, SHACL_NODE_KIND, SHACL_LITERAL, XSD_BOOLEAN, XSD_DATE, XSD_DATE_TIME, SHACL_IN, SHACL_CLASS, DASH_ROOT_CLASS, DASH_SINGLE_LINE, RDF_TRUE, RDF_FALSE, SHACL_IRI } from './common'

import N3, { NamedNode } from 'n3';
import { PropertyShape } from './shacl';

export const DASH_BLANK_NODE_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#BlankNodeViewer")
export const DASH_DETAILS_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#DetailsViewer")
export const DASH_HTML_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#HTMLViewer")
export const DASH_HYPERLINK_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#HyperlinkViewer")
export const DASH_IMAGE_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#ImageViewer")
export const DASH_LABEL_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#LabelViewer")
export const DASH_LANGSTRING_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#LangStringViewer")
export const DASH_LITERAL_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#LiteralViewer")
export const DASH_URI_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#URIViewer")
export const DASH_VALUE_TABLE_VIEWER = N3.DataFactory.namedNode("http://datashapes.org/dash#ValueTableViewer")

export const DASH_AUTO_COMPLETE_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#AutoCompleteEditor");
export const DASH_BLANK_NODE_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#BlankNodeEditor");
export const DASH_BOOLEAN_SELECT_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#BooleanSelectEditor");
export const DASH_DATE_PICKER_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#DatePickerEditor");
export const DASH_DATE_TIME_PICKER_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#DateTimePickerEditor");
export const DASH_DETAILS_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#DetailsEditor");
export const DASH_ENUM_SELECT_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#EnumSelectEditor");
export const DASH_INSTANCES_SELECT_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#InstancesSelectEditor");
export const DASH_RICH_TEXT_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#RichTextEditor");
export const DASH_SUB_CLASS_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#SubClassEditor");
export const DASH_TEXT_AREA_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#TextAreaEditor");
export const DASH_TEXT_AREA_WITH_LANG_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#TextAreaWithLangEditor");
export const DASH_TEXT_FIELD_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#TextFieldEditor");
export const DASH_TEXT_FIELD_WITH_LANG_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#TextFieldWithLangEditor");
export const DASH_URI_EDITOR = N3.DataFactory.namedNode("http://datashapes.org/dash#UriEditor");

export const MOON_ANY_VIEWER = N3.DataFactory.namedNode(`${MOON_BASE}/AnyViewer`)
export const MOON_GEO_VIEWER = N3.DataFactory.namedNode(`${MOON_BASE}/GeoViewer`)
export const MOON_GEO_EDITOR = N3.DataFactory.namedNode(`${MOON_BASE}/GeoEditor`)
export const MOON_CODE_EDITOR = N3.DataFactory.namedNode(`${MOON_BASE}/CodeEditor`)
export const MOON_CODE_VIEWER = N3.DataFactory.namedNode(`${MOON_BASE}/CodeViewer`)

export type WidgetScorer = (property: PropertyShape, value?: N3.Term) => number | null
export interface DashWidget {
  iri: string | N3.NamedNode, // The IRI that references this widget.

  score: WidgetScorer
}

function scoreValue(s: (v: N3.Term) => number | null): WidgetScorer {
  return (p, v) => v === undefined ? null : s(v)
}

function scoreType(t: N3.NamedNode): WidgetScorer {
  return (p, v) => {
    if ( (v !== undefined && v.termType == 'Literal' && v.datatype.equals(t)) ) {
      return 10
    } else if ( p.canBeLiteralWithType(t) ) {
      return 5
    } else if ( p.canBeLiteral() ) {
      return 1;
    } else {
      return 0;
    }
  }
}

const scoreTextArea: WidgetScorer = (p, v) => {
  if ( p.isSingleLine() ) {
    return 0;
  }
  const isString = p.canBeLiteralWithType(XSD_STRING)
  if ( isString && p.isSingleLine() ) {
    return 20;
  } else if ( v && v.termType == 'Literal' && v.datatype.equals(XSD_STRING) ) {
    return 5;
  } else if ( isString ) {
    return 2;
  } else if ( v && v.termType == 'Literal' ) {
    return null;
  } else {
    return 0;
  }
}

const scoreTextAreaWithLang: WidgetScorer = (p, v) => {
  if ( p.isSingleLine() ) {
    return 0;
  }
  const permitsLangString = p.canBeLiteralWithType(RDF_LANG_STRING)
  const isMultiLine = p.isMultiLine()
  if ( v && v.termType == 'Literal' && v.datatype.equals(RDF_LANG_STRING) && isMultiLine ) {
    return 15
  } else if ( ( v && v.termType == 'Literal' && v.datatype.equals(RDF_LANG_STRING)) || permitsLangString ) {
    return 5
  } else {
    return 0
  }
}

const scoreTextField: WidgetScorer = (p, v) => {
  if ( p.canBeLiteralWithType(XSD_STRING) ||
    (v && v.termType == 'Literal' && v.datatype.equals(XSD_STRING)) ) {
    return 20;
    } else if ( v && v.termType == 'Literal' && !v.datatype.equals(RDF_LANG_STRING) && !v.datatype.equals(XSD_BOOLEAN) || p.canBeLiteralWithType(XSD_STRING)) {
    return 10
  } else {
    return 0
  }
}

const scoreTextFieldWithLang: WidgetScorer = (p, v) => {
  const allowsString = p.canBeLiteralWithType(XSD_STRING)
  const allowsLangString = p.canBeLiteralWithType(RDF_LANG_STRING)
  const notMultiline = !p.isSingleLine()
  if ( (v && v.termType == 'Literal' && v.datatype.equals(RDF_LANG_STRING)) ||
    allowsLangString || allowsString ) {
    return 11;
    } else if ( notMultiline && allowsLangString ) {
    return 5
  } else {
    return 0
  }
}

const scoreUriEditor: WidgetScorer = (p, v) => {
  if ( v && v.termType == 'NamedNode' &&
    p.mustBeIRI() &&
    p.getRestrictedClasses() !== null ) {
    return 10
  } else if ( v && v.termType == 'NamedNode' ) {
    return null
  } else {
    return 0
  }
}

export interface DashEditors {
  viewers: DashWidget[],
  editors: DashWidget[]
}

function isImageUri(v: string) {
  return v.endsWith(".png") || v.endsWith(".jpg")
}

export const BASE_EDITORS: DashEditors = {
  viewers: [
    { iri: DASH_BLANK_NODE_VIEWER,
      score: scoreValue((v) => v.termType == 'BlankNode' ? 1 : 0)
    },
    { iri: DASH_DETAILS_VIEWER,
      score: scoreValue((v) => v.termType == 'Literal' ? 0 : null)
    },
    { iri: DASH_HTML_VIEWER,
      score: scoreValue((v) => v.termType == 'Literal' && v.datatype == RDF_HTML ? 50 : 0)
    },
    { iri: DASH_HYPERLINK_VIEWER,
      score: scoreValue((v) => {
        if ( v.termType == 'Literal' ) {
          if ( v.datatype == XSD_ANYURI ) { return 50; }
          else if ( v.datatype == XSD_STRING ) { return null; }
        }
        return 0
      })
    },
    { iri: DASH_IMAGE_VIEWER,
      score: scoreValue((v) => {
        if ( v.termType == 'NamedNode' && isImageUri(v.value) ) { return 50; }
        return 0;
      })
    },
    { iri: DASH_LABEL_VIEWER,
      score: scoreValue((v) => v.termType == 'NamedNode' ? 5 : 0)
    },
    { iri: DASH_LANGSTRING_VIEWER,
      score: scoreValue((v) => v.termType == 'Literal' && v.datatype == RDF_LANG_STRING ? 10 : 0)
    },
    { iri: DASH_LITERAL_VIEWER,
      score: scoreValue((v) => v.termType == 'Literal' ? 1 : 0)
    },
    { iri: DASH_URI_VIEWER,
      score: scoreValue((v) => v.termType == 'NamedNode' ? 1 : 0)
    }
    // VALUE TABLE VIEWER is handled elsewhere
  ],
  editors: [
    { iri: DASH_AUTO_COMPLETE_EDITOR,
      score: scoreValue((v) => v.termType == 'NamedNode' ? 1 : 0) },
    { iri: DASH_BLANK_NODE_EDITOR,
      score: scoreValue((v) => v.termType == 'BlankNode' ? 1 : 0) },
    { iri: DASH_BOOLEAN_SELECT_EDITOR,
      score: (property: PropertyShape, v?: N3.Term) => {
        if ( (v && v.termType == 'Literal' && v.datatype == XSD_BOOLEAN) ||
          property.mustBeLiteralWithType(XSD_BOOLEAN)
        ) {
          return 10
        } else if ( property.mustBeLiteral() ) {
          return null
        } else {
          return 0
        }
      }
    },
    { iri: DASH_DATE_PICKER_EDITOR,
      score: scoreType(XSD_DATE)
    },
    { iri: DASH_DATE_TIME_PICKER_EDITOR,
      score: scoreType(XSD_DATE_TIME)
    },
    { iri: DASH_DETAILS_EDITOR,
      score: scoreValue((v) => v.termType == 'Literal' ? 0 : null)
    },
    { iri: DASH_ENUM_SELECT_EDITOR,
      score: (property: PropertyShape, v?: N3.Term) => {
        if ( property.getRestrictedValues() !== null ) {
          return 10;
        } else {
          return 0;
        }
      }
    },
    { iri: DASH_INSTANCES_SELECT_EDITOR,
      score: (property: PropertyShape, v?: N3.Term) => {
        if ( property.getRestrictedClasses() !== null ) {
          return null;
        } else {
          return 0;
        }
      }
    },
    { iri: DASH_RICH_TEXT_EDITOR,
      score: scoreType(RDF_HTML)
    },
    { iri: DASH_SUB_CLASS_EDITOR,
      score: (property: PropertyShape, v?: N3.Term) => {
        if ( property.getRestrictedRootClasses() !== null ) {
          return 10
        } else {
          return null;
        }
      }
    },
    { iri: DASH_TEXT_AREA_EDITOR,
      score: scoreTextArea },
    { iri: DASH_TEXT_AREA_WITH_LANG_EDITOR,
      score: scoreTextAreaWithLang },
    { iri: DASH_TEXT_FIELD_EDITOR,
      score: scoreTextField },
    { iri: DASH_TEXT_FIELD_WITH_LANG_EDITOR,
      score: scoreTextFieldWithLang },
    { iri: DASH_URI_EDITOR,
      score: scoreUriEditor }
  ]
}

export function rankWidgets(
  propertyDef: PropertyShape, value: N3.Term | null,
  editors: DashEditors,
  editing:boolean = false
): string[]
{
  const viewer = propertyDef.getViewer(editing)
  const PREDEFINED_WIDGETS = editing ? editors.editors : editors.viewers

  const allScores: {score: number | null, widget: DashWidget}[] = PREDEFINED_WIDGETS.map((w) => ({
    score: w.score(propertyDef, value || undefined),
    widget: w}))
  const manual = allScores.flatMap((s) => s.score === null ? [s.widget] : [])
  const scores = allScores.flatMap((s) => s.score !== null && s.score > 0 ? [{score: s.score, widget: s.widget}]: [])

  scores.sort((a, b) => b.score - a.score)

  let ret = scores.map((w) => w.widget.iri instanceof NamedNode
    ? w.widget.iri.value : w.widget.iri)
    .filter((w) => w != viewer?.value)
  let overrides = viewer ? [viewer.value] : []

  return [...overrides, ...ret];
}

export function editorHandlesMultiples(globalViewer: N3.Term) {
  return globalViewer.equals(DASH_INSTANCES_SELECT_EDITOR)
}

export function restrictionForClasses(classes: string[]) {
  let classesRestriction = classes.map((cls) => `{ ?s <http://www.w3.org/2000/01/rdf-schema#subClassOf>* <${cls}> }`).join(" UNION ")
  return `?s a <http://www.w3.org/2000/01/rdf-schema#Class>.
${classesRestriction}`
}
