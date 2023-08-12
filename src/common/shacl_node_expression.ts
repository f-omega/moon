// SHACL node expressions from shacl-AF
import N3 from 'n3'
import { parseShaclPath, PropertyShape, ShaclPath } from './shacl'
import { getProperty, listFromRdf, SHACL_COUNT, SHACL_PREFIXES, SHACL_DECLARE, SHACL_PREFIX,
  SHACL_DISTINCT, SHACL_ELSE, SHACL_EXISTS, SHACL_FILTER_SHAPE, SHACL_IF, SHACL_INTERSECTION,
  SHACL_NODES, SHACL_PATH, SHACL_THEN, SHACL_THIS, SHACL_UNION, SHACL_NAMESPACE, SHACL_SELECT,
  SHACL_ASK, XSD_STRING, XSD_ANYURI } from './util'
import { Parser as SparqlParser, SparqlQuery } from 'sparqljs'

export type ShaclNodeExpression =
  FocusNodeExpression | ConstantTermExpression | ExistsExpression |
    IfExpression | FilterShapeExpression | FunctionExpression |
    PathExpression | SetExpression | MinusExpression |
    PrimitiveExpression | OrderByExpression | LimitOffsetExpression |
    SparqlExpression

export interface FocusNodeExpression {
  type: 'focus'
}

export interface ConstantTermExpression {
  type: 'term'
  value: N3.Term
}

export interface ExistsExpression {
  type: 'exists'
  expr: ShaclNodeExpression
}

export interface IfExpression {
  type: 'if'
  condition: ShaclNodeExpression
  then: ShaclNodeExpression
  else_: ShaclNodeExpression
}

export interface FilterShapeExpression {
  type: 'filterShape'
  shape: PropertyShape
}

export interface FunctionExpression {
  type: 'fn'
  function_: N3.NamedNode,
  args: ShaclNodeExpression[]
}

export interface PathExpression {
  type: 'path',
  nodes?: ShaclNodeExpression,
  path: ShaclPath
}

export interface SetExpression {
  type: 'intersection' | 'union'
  args: ShaclNodeExpression[]
}

export interface MinusExpression {
  type: 'minus'
  base: ShaclNodeExpression
  removed: ShaclNodeExpression
}

export interface PrimitiveExpression {
  type: 'distinct' | 'count' | 'min' | 'max' | 'sum' | 'groupConcat'
  expr: ShaclNodeExpression
}

export interface OrderByExpression {
  type: 'orderBy'
  nodes: ShaclNodeExpression,
  key: ShaclNodeExpression,
  order: 'ascending' | 'descending'
}

export interface LimitOffsetExpression {
  type: 'limit' | 'offset'
  nodes: ShaclNodeExpression
  arg: number
}

export interface SparqlExpression {
  type: 'ask' | 'select',
  prefices: {[pre: string]: string},
  nodes?: ShaclNodeExpression,
  query: SparqlQuery
}

function getSingularBlankNode(g: N3.Store, o: N3.Term): [N3.Term?, N3.Term?] {
  let qs = g.getQuads(o, null, null, null);
  if ( qs.length == 1 ) {
    return [qs[0].predicate, qs[0].object]
  }
  return [ undefined, undefined ]
}

function parseFunction(g: N3.Store, fn: N3.Term, args: N3.Term): ShaclNodeExpression {
  function readFunctionArgs(g: N3.Store, path: N3.Term) {
    const args = listFromRdf(g, path);
    if ( args === null ) {
      throw new TypeError("Function args were not a sequence")
    }
    return args.map((a) => parseShaclNodeExpression(g, a))
  }
  if ( fn.equals(SHACL_EXISTS) ) {
    const expr = parseShaclNodeExpression(g, args);
    return { type: 'exists', expr }
  } else if ( fn.equals(SHACL_FILTER_SHAPE) ) {
    throw new TypeError("sh:filterShape not implemented")
  } else if ( fn.equals(SHACL_PATH) ) {
    const path = parseShaclPath(g, args);
     if ( path === null ) {
      throw new TypeError("Could not parse sh:path");
    }
    return { type: 'path', path }
  } else if ( fn.equals(SHACL_UNION) ) {
  return { type: 'union', args: readFunctionArgs(g, args) }
  } else if ( fn.equals(SHACL_INTERSECTION) ) {
    return { type: 'intersection', args: readFunctionArgs(g, args) }
  } else if ( fn.equals(SHACL_DISTINCT) ) {
    const expr = parseShaclNodeExpression(g, args);
    return { type: 'distinct', expr }
  } else if ( fn.equals(SHACL_COUNT) ) { const expr = parseShaclNodeExpression(g, args);
    return { type: 'distinct', expr }
  } else if ( fn.termType == 'NamedNode' ) {
    return { type: 'fn', function_: fn, args: readFunctionArgs(g, args) }
  } else {
    throw new TypeError("Invalid shacl node expression")
  }
}

function parsePathStmt(g: N3.Store, o: N3.Term, pathStmt: N3.Term): PathExpression {
  const path = parseShaclPath(g, pathStmt);
  if ( path === null ) {
    throw new TypeError("Could not parse sh:path");
  }
  let nodes: ShaclNodeExpression | undefined

  let nodeStmt = getProperty(g, o, SHACL_NODES, { multiple: false })
  if ( nodeStmt !== null ) {
    nodes = parseShaclNodeExpression(g, nodeStmt)
  }

  return { type: 'path', path, nodes }
}

function parseIfStmt(g: N3.Store, stmt: N3.Term, conditionDef: N3.Term ): IfExpression {
  const condition = parseShaclNodeExpression(g, conditionDef)

  const thenDef = getProperty(g, stmt, SHACL_THEN, { multiple: false });
  const then = parseShaclNodeExpression(g, thenDef)

  const elseDef = getProperty(g, stmt, SHACL_ELSE, { multiple: false });
  const else_ = parseShaclNodeExpression(g, elseDef)

  return {
    type: 'if',
    condition, then, else_
  }
}

function parseSparqlStmt(type: 'ask' | 'select', g: N3.Store, o: N3.Term, stmt: string): SparqlExpression {
  let prefices: {[pre: string]: string} = {}
  let nodes: ShaclNodeExpression | undefined

  let nodesDef = getProperty(g, o, SHACL_NODES, { multiple: false })
  if ( nodesDef !== null ) {
    nodes = parseShaclNodeExpression(g, nodesDef)
  }

  let preficesStmts: N3.Term[] | null = getProperty(g, o, SHACL_PREFIXES, {multiple: true})
  if ( preficesStmts !== null ) {
    let allPrefices: [string, string][] = preficesStmts.flatMap((p: N3.Term) => {
      let subPrefices = getProperty(g, p, SHACL_DECLARE, {multiple: true})
      if ( subPrefices === null ) return [];

      return subPrefices.flatMap((sp: N3.Term) => {
        let prefix: string | null =
          getProperty(g, sp, SHACL_PREFIX, {multiple: false, literal: true, expectedType: XSD_STRING})
        let ns: string | null =
          getProperty(g, sp, SHACL_NAMESPACE, {multiple: false, literal: true, expectedType: XSD_ANYURI})
        if ( prefix === null || ns === null ) return []
        return [[ prefix, ns ]]
      });
    })
    prefices = Object.fromEntries(allPrefices);
  }

  const parser = new SparqlParser()
  const prefixDecl = Object.entries(prefices).map(([pre, iri]) => `PREFIX ${pre}: <${iri}>`).join('\n')
  const parsedQuery = parser.parse(`${prefixDecl}\n${stmt}`)

  return { type, query: parsedQuery, prefices, nodes }
}

/// Parse a term into a shacl node expression following rules from
export function parseShaclNodeExpression(g: N3.Store, o: N3.Term): ShaclNodeExpression {
  if ( o.equals(SHACL_THIS) ) {
    return { type: 'focus' }
  }

  if ( o.termType == 'NamedNode' || o.termType == 'Literal' ) {
    return { type: 'term', value: o }
  }

  let ifStmt = getProperty(g, o, SHACL_IF, { multiple: false });
  if ( ifStmt !== null ) {
    return parseIfStmt(g, o, ifStmt)
  }

  let pathStmt = getProperty(g, o, SHACL_PATH, { multiple: false });
  if ( pathStmt !== null ) {
    return parsePathStmt(g, o, pathStmt)
  }

  let askStmt = getProperty(g, o, SHACL_ASK, {multiple: false, literal: true, expectedType: XSD_STRING});
  if ( askStmt !== null ) {
    return parseSparqlStmt("ask", g, o, askStmt)
  }

  let selectStmt = getProperty(g, o, SHACL_SELECT, {multiple: false, literal: true, expectedType: XSD_STRING});
  if ( selectStmt !== null ) {
    return parseSparqlStmt("select", g, o, selectStmt)
  }

  const [fn, args] = getSingularBlankNode(g, o);
  if ( fn !== undefined && args !== undefined ) {
    return parseFunction(g, fn, args)
  }

  throw new TypeError("Could not parse Shacl node expression")
}

// Some shacl node expressions can be executed directly in sparql.
// If so, this function returns that SPARQL.
// Otherwise, returns NULL
export function shaclNodeExprToSparql(thisVar: string, outputVar: string, expr: ShaclNodeExpression): string | null {
  let selectStmt
  let parser = new SparqlParser()
  if ( expr.type == 'ask' ) {
    // Returns boolean
  }
  return null;
}
