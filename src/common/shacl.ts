// Provides functions that given a term and a graph: aph, can look up the SHACL shapes
import N3 from 'n3'
import { useEffect, useMemo, useState } from 'react'
import { useCache } from '../cache'
import * as util from '../common/util'
import { DASH_INSTANCES_SELECT_EDITOR } from '../sparql/dash'
import { ShaclNodeExpression, parseShaclNodeExpression } from './shacl_node_expression'


export type ShaclPath =
  SimpleShaclPath | AlternativePath | SequencePath

export type NonSequenceShaclPath =
  AlternativePath | SimpleShaclPath

export type NonAlternativeShaclPath =
  SequencePath | SimpleShaclPath

export type SimpleShaclPath =
  PredicatePath | ModifierPath

export interface PredicatePath {
  type: 'property',
  property: N3.Term
}

export interface SequencePath {
  type: 'sequence',
  path: NonSequenceShaclPath[]
}

export interface AlternativePath {
  type: 'alternative',
  alternatives: NonAlternativeShaclPath[] & { 0: NonAlternativeShaclPath, 1: NonAlternativeShaclPath }
}

export interface ModifierPath {
  type: 'inverse' | 'zeroOrMore' | 'oneOrMore' | 'zeroOrOne',
  underlying: ShaclPath
}

// TODO test
export function invertShaclPath(p: ShaclPath): ShaclPath {
  if ( p.type == 'alternative' ) {
    return {
      type: 'alternative',

      // @ts-ignore
      alternatives: p.alternatives.map(invertShaclPath)
    }
  } else if ( p.type == 'inverse' ) {
    return p.underlying
  } else if ( p.type == 'oneOrMore' || p.type == 'zeroOrMore' || p.type == 'zeroOrOne' ) {
    return { type: p.type, underlying: invertShaclPath(p.underlying) }
  } else if ( p.type == 'property' ) {
    return { type: 'inverse', underlying: p }
  } else if ( p.type == 'sequence' ) {
    let path = [ ...p.path ]
    path.reverse()
    // @ts-ignore
    path = path.map(invertShaclPath)
    return { type: 'sequence', path }
  } else {
    throw new TypeError(`Cannot invert path of type ${p.type}`)
  }
}

// TODO test
export function splitShaclPath(p: ShaclPath, predVar: string): [boolean, ShaclPath|null, string, string[]][] {
  function splatPaths(path: NonSequenceShaclPath[], p: ShaclPath | null): SequencePath {
    if ( p === null ) {
      return { type: 'sequence', path }
    } else if ( p.type == 'sequence' ) {
      return { type: 'sequence', path: [ ...path, ...p.path ] }
    } else {
      return { type: 'sequence', path: [ ...path, p ] }
    }
  }

  if ( p.type == 'inverse' ) {
    return splitShaclPath(invertShaclPath(p), predVar)
  } else if ( p.type == 'alternative' ) {
    // TODO GROUP
    return p.alternatives.flatMap((p) => splitShaclPath(p, predVar))
  } else if ( p.type == 'sequence' ) {
    let path = [ ...p.path ]
    const [ last ] = path.splice(path.length - 1, 1)
    return splitShaclPath(last, predVar).map(([canIncludeParent, parentPath, predConds, exampleLastHop]) => {
      return [ canIncludeParent, splatPaths(path, parentPath), predConds, exampleLastHop ]
    })
  } else if ( p.type == 'property' ) {
    // The current focus node is the parent, there are no other routes to the parent, and the predicate must be the onne given
    return [[true, null, `VALUES ?${predVar} { <${p.property.value}> }`, [p.property.value] ]]
  } else if ( p.type == 'oneOrMore' ) {
    // The path gets converted into a zeroOrMore and then we split the underlying
    // All newpaths must first match the zeroOrMore, and then follow the underlying
    const newPrefix: NonSequenceShaclPath = { type: 'zeroOrMore', underlying: p.underlying }
    return splitShaclPath(p.underlying, predVar).flatMap(([canIncludeParent, parentPath, predConds, exampleLastHop]) => {
      const ret: [boolean, ShaclPath|null, string, string[]][] =
        [ [ false, splatPaths([newPrefix], parentPath), predConds, exampleLastHop ] ]
      if ( canIncludeParent ) {
        const withParent : [ boolean, ShaclPath, string, string[] ] = [false, newPrefix, predConds, exampleLastHop ]
        ret.push(withParent)
      }
      return ret
    })
  } else if ( p.type == 'zeroOrMore' ) {
    // All new paths can either go directly, or with a zeroOrMore in front
    return splitShaclPath(p.underlying, predVar).map(([canIncludeParent, parentPath, predConds, exampleLastHop]) => {
      return [canIncludeParent, splatPaths([p], parentPath), predConds, exampleLastHop]
    })
  } else if ( p.type == 'zeroOrOne' ) {
    // The current focus node can be the parent. The other route to the parent is whatever's beneath us
    return splitShaclPath(p.underlying, predVar).map(([_canBeParent, parentRoute, predConditions, exampleLastHop]) => {
      // Focus node can be the parent (zero or one). Or, it can be whatever route this would take us to.
      return [ true, parentRoute, predConditions, exampleLastHop]
    })
  } else {
    throw new TypeError(`Unknown pred type ${p.type}`)
  }
}

export function parseShaclPath(g: N3.Store, path: N3.Term): ShaclPath | null {
  // A path is either an IRI (Predicate path) or a sequence, where each term in the sequence is a path
  // Or it's a blank node of a particular type
  if (path.termType == 'BlankNode') {
    let sequence = util.listFromRdf(g, path)
    if (sequence !== null) {
      let paths: NonSequenceShaclPath[] = []
      for (const o of sequence) {
        let next = parseShaclPath(g, o)
        if (next === null) return null

        if (next.type == 'sequence') {
          paths = [...paths, ...next.path]
        } else {
          paths = [...paths, next]
        }
      }
      return { type: 'sequence', path: paths }
    } else {
      let details = g.getQuads(path, null, null, null)
      if (details.length == 0) {
        return null
      } else {
        if (details[0].predicate.equals(util.SHACL_ALTERNATIVE_PATH)) {
          let alts = util.listFromRdf(g, details[0].object)
          if (alts === null || alts.length < 2) return null;

          let alternatives: NonAlternativeShaclPath[] = []
          for (const alt of alts) {
            const next = parseShaclPath(g, alt)
            if (next === null) return null

            if (next.type == 'alternative') {
              alternatives = [...alternatives, ...next.alternatives]
            } else {
              alternatives = [...alternatives, next]
            }
          }

          // @ts-ignore
          return { type: 'alternative', alternatives }
        } else {
          let type: 'inverse' | 'zeroOrMore' | 'oneOrMore' | 'zeroOrOne' | null = null
          if (details[0].predicate.equals(util.SHACL_INVERSE_PATH)) {
            type = 'inverse';
          } else if (details[0].predicate.equals(util.SHACL_ZERO_OR_MORE_PATH)) {
            type = 'zeroOrMore';
          } else if (details[0].predicate.equals(util.SHACL_ONE_OR_MORE_PATH)) {
            type = 'oneOrMore';
          } else if (details[0].predicate.equals(util.SHACL_ZERO_OR_ONE_PATH)) {
            type = 'zeroOrOne';
          }

          if (type === null) {
            return null;
          }

          let underlying = parseShaclPath(g, details[0].object)
          if (underlying === null) return null;
          else return { type, underlying }
        }
      }
    }
  } else if (path.termType == 'NamedNode') {
    // Property path
    return { type: 'property', property: path }
  } else {
    return null;
  }
}

export function pathToSparql(path: ShaclPath): string {
  if (path.type == 'alternative') {
    return '(' + path.alternatives.map(pathToSparql).join("|") + ')'
  } else if (path.type == 'sequence') {
    return '(' + path.path.map(pathToSparql).join("/") + ')'
  } else if (path.type == 'inverse') {
    return '(^' + pathToSparql(path.underlying) + ')'
  } else if (path.type == 'oneOrMore') {
    return '(' + pathToSparql(path.underlying) + ')+'
  } else if (path.type == 'zeroOrMore') {
    return '(' + pathToSparql(path.underlying) + ')*'
  } else if (path.type == 'zeroOrOne') {
    return '(' + pathToSparql(path.underlying) + ')?'
  } else if (path.type == 'property') {
    return '<' + path.property.value + '>'
  } else {
    throw new TypeError("pathToSparql() called with invalid ShaclPath")
  }
}

export interface NodeKinds {
  iri: boolean,
  blankNode: boolean,
  literal: boolean
}

// Our view of constraints

// Object representing a shacl node shape in the given store

export type Conjunctions<Constraint> =
  {
    type: 'and' | 'or' | 'xone'
    sub: Conjunctions<Constraint>[]
  } |
    { type: 'not', sub: Constraint } |
    { type: 'single', source: N3.Term, sub: Constraint }

abstract class BaseConstraint {
  constructor() {
  }

  abstract isEmpty(): boolean;
}

export interface GroupSpec {
  iri: N3.Term,
  order: number,
  name: string,
  description?: string
}

export class ShapeContext {
  graph: N3.Store
  propertyShapes: { [id: string]: PropertyShape };
  nodeShapes: { [id: string]: NodeShape };
  groups: { [id: string]: GroupSpec }

  constructor(graph: N3.Store) {
    this.graph = graph
    this.nodeShapes = {}
    this.propertyShapes = {}
    this.groups = {}
  }

  getGroup(iri: N3.Quad_Subject): GroupSpec {
    if (iri.id in this.groups) return this.groups[iri.id]
    else {
      let name = util.getProperty(this.graph, iri, util.SHACL_NAME,
        { literal: true, expectedType: util.XSD_STRING }) || iri.id
      let description = util.getProperty(this.graph, iri, util.SHACL_DESCRIPTION,
        { literal: true, expectedType: util.XSD_STRING }) || undefined
      let order = util.getProperty(this.graph, iri, util.SHACL_ORDER,
        { literal: true, expectedType: util.XSD_INTEGER }) || 10000
      this.groups[iri.id] = { iri, name, description, order }
      return this.groups[iri.id]
    }
  }

  getProperty(iri: N3.Quad_Subject): PropertyShape {
    if (iri.id in this.propertyShapes) return this.propertyShapes[iri.id]
    else {
      const shp = new PropertyShape(this.graph, iri, this)
      this.propertyShapes[iri.id] = shp
      shp._connectNodes();
      return shp
    }
  }

  getNode(iri: N3.Quad_Subject): NodeShape {
    if (iri.id in this.nodeShapes) return this.nodeShapes[iri.id]
    else {
      const shp = new NodeShape(this.graph, iri, this)
      this.nodeShapes[iri.id] = shp
      return shp
    }
  }
}

function dedupConj<X>(sub: Conjunctions<X>[]): Conjunctions<X>[] {
  let seen: { [id: string]: true } = {}
  let next: Conjunctions<X>[] = []
  for (const s of sub) {
    if (s.type == 'single') {
      if (s.source.id in seen) continue
      seen[s.source.id] = true
    }
    next.push(s)
  }
  return next
}

export abstract class Shape<Constraint extends BaseConstraint> {
  graph: N3.Store
  context: ShapeContext

  constraints: Conjunctions<Constraint>

  constructor(graph: N3.Store, shape?: N3.Quad_Subject, context?: ShapeContext) {
    this.graph = graph
    if (context === undefined) {
      context = new ShapeContext(graph)
    }

    this.context = context

    this.constraints = { type: 'and', sub: [] }
    if (shape !== undefined) {
      const constraints = this.readConstraint(shape)
      if (constraints !== null)
        this.constraints = constraints
      else {
        this.constraints = { type: 'single', source: shape, sub: this._emptyConstraint() }
      }
    }
  }

  protected _collectList(t: N3.Term): N3.Term[] | null {
    return util.listFromRdf(this.graph, t)
  }


  protected abstract _emptyConstraint(): Constraint;
  protected abstract _readConstraint(root: N3.Term): Constraint;
  protected abstract _readChildConstraint(root: N3.Term): Constraint;

  protected readConstraint(root: N3.Term): Conjunctions<Constraint> | null {
    // Read sh:ands and sh:ors
    let c = this._readConstraint(root)

    let ands = this.graph.getQuads(root, util.SHACL_AND, null, null)
      .map((q) => this._collectList(q.object))
      .flatMap((q) => q === null ? [] : [q])
    let ors = this.graph.getQuads(root, util.SHACL_OR, null, null)
      .map((q) => this._collectList(q.object))
      .flatMap((q) => q === null ? [] : [q])
    let xones = this.graph.getQuads(root, util.SHACL_XONE, null, null)
      .map((q) => this._collectList(q.object))
      .flatMap((q) => q === null ? [] : [q])
    let nots = this.graph.getQuads(root, util.SHACL_NOT, null, null)
      .map((q) => q.object)

    let subs: Conjunctions<Constraint>[] = []
    if (!c.isEmpty()) {
      subs.push({ type: 'single', source: root, sub: c })
    }

    const shape = this;
    function readConstraintFlat(t: N3.Term): Conjunctions<Constraint>[] {
      const c = shape.readConstraint(t)
      if (c === null) return []
      else return [c]
    }

    for (const and of ands) {
      subs = dedupConj([...subs, ...and.flatMap(readConstraintFlat)])
    }
    for (const or of ors) {
      subs.push({ type: 'or', sub: dedupConj(or.flatMap(readConstraintFlat)) })
    }
    for (const xone of xones) {
      subs.push({ type: 'xone', sub: dedupConj(xone.flatMap(readConstraintFlat)) })
    }
    for (const not of nots) {
      // Not is weird as it can be the same constraint as ours or a child constraint (sh:node/sh:property)
      const x = this._readChildConstraint(not)
      if (x === null) continue;
      subs.push({ type: 'not', sub: x })
    }

    if (subs.length == 1) { return subs[0]; }
    else { return { type: 'and', sub: subs } }
  }

  foldConditions<X>(fs: FoldConditions<Constraint, X>): X {
    function walk(t: Conjunctions<Constraint>) {
      switch (t.type) {
        case 'single':
          return fs.singlecb(t.sub)
        case 'xone':
        case 'and':
        case 'or':
          let cur = fs[`${t.type}unit`]
          for (const o of t.sub) {
            cur = fs[`${t.type}cb`](cur, walk(o))
          }
          return cur;
        case 'not':
          return fs.notcb(fs.singlecb(t.sub))
      }
    }
    return walk(this.constraints)
  }

  protected walkAllConditions(cb: (c: Constraint, negated: boolean) => void) {
    function walk(t: Conjunctions<Constraint>, negated: boolean) {
      if (t.type == 'single') {
        cb(t.sub, negated)
      } else if (t.type == 'not') {
        cb(t.sub, !negated)
      } else {
        for (const s of t.sub) {
          walk(s, negated)
        }
      }
    }
    walk(this.constraints, false)
  }
}

export interface FoldConditions<Constraint, X> {
  orcb: (left: X, right: X) => X,
  andcb: (left: X, right: X) => X,
  xonecb: (left: X, right: X) => X,
  notcb: (n: X) => X,
  singlecb: (c: Constraint) => X,
  orunit: X, andunit: X, xoneunit: X
}

export class NodeShape extends Shape<NodeConstraint> {
  shape?: N3.Quad_Subject
  showType: boolean

  constructor(graph: N3.Store, shape?: N3.Quad_Subject, context?: ShapeContext) {
    super(graph, shape, context)
    this.shape = shape

    this.showType = true

    if ( this.shape ) {
      const hideType = util.getProperty(this.graph, this.shape, util.MOON_HIDE_TYPE, {literal: true, expectedType: util.XSD_BOOLEAN})
      if ( hideType ) {
        this.showType = false
      }
    }
  }

  getSubjectSuggesters(): ((p: string, v: any) => string)[] {
    if ( this.shape === undefined ) return [];

    let exprs = util.getProperty(this.graph, this.shape, util.MOON_SUGGESTED_SUBJECT, {
      multiple: true, expectedType: util.MOON_JAVASCRIPT_EXPR, literal: true})
    return exprs.map((expr: string) => new Function("uri", "props", expr))
  }

  static conjunction(shapes: NodeShape[]): NodeShape {
    const graph = new N3.Store()
    let sub: Conjunctions<NodeConstraint>[] = []
    for (const shape of shapes) {
      util.graphUnionInPlace(graph, shape.graph)
      if (shape.constraints.type == 'and') {
        sub = [...sub, ...shape.constraints.sub]
      } else {
        sub = [...sub, shape.constraints]
      }
    }

    sub = dedupConj(sub)

    const nodeShape = new NodeShape(graph)
    if (sub.length == 1) {
      nodeShape.constraints = sub[0]
    } else {
      nodeShape.constraints = { type: 'and', sub: dedupConj(sub) }
    }
    return nodeShape
  }

  _emptyConstraint(): NodeConstraint {
    return new NodeConstraint()
  }

  _readConstraint(t: N3.Term): NodeConstraint {
    return new NodeConstraint(t, this.context)
  }

  _readChildConstraint(t: N3.Term): NodeConstraint {
    if (!(t instanceof N3.NamedNode) && !(t instanceof N3.BlankNode)) {
      throw new TypeError("Can't read constraint from literal")
    }

    if (this.graph.has(N3.DataFactory.triple(t, util.RDF_TYPE, util.SHACL_NODE_SHAPE))) {
      return this._readConstraint(t)
    } else if (this.graph.has(N3.DataFactory.triple(t, util.RDF_TYPE, util.SHACL_PROPERTY_SHAPE))) {
      const shp = this.context.getProperty(t)
      const ret = new NodeConstraint()
      ret.properties = [shp]
      return ret
    } else {
      return this._readConstraint(t)
    }
  }

  /// Lists all properties
  properties(): PropertyShape[] {
    const ret: PropertyShape[] = []
    const seen: { [id: string]: true } = {}
    this.walkAllConditions((c: NodeConstraint, negated: boolean) => {
      if (negated) return

      for (const p of c.properties) {
        if (p.shape.id in seen) continue
        seen[p.shape.id] = true
        ret.push(p)
      }
    })
    return ret
  }
}

export class PropertyShape extends Shape<PropertyConstraint> {
  shape: N3.Quad_Subject
  path?: ShaclPath
  inferredValue?: ShaclNodeExpression
  group: GroupSpec | null
  order: number
  name: string
  description: string | null
  nodeShape: NodeShape[]

  private _editable?: boolean
  private _jsonProperty?: string

  constructor(graph: N3.Store, shape: N3.Quad_Subject, context?: ShapeContext) {
    super(graph, shape, context)
    this.shape = shape

    let qs = graph.getQuads(shape, util.SHACL_PATH, null, null)
    console.log("GOT QS for PATH", qs);
    if (qs.length > 0) {
      const path = parseShaclPath(graph, qs[0].object)
      if (path !== null)
        this.path = path
      else {
        throw new TypeError("Invalid shacl path")
      }
    }

    // Check if it's inferred
    qs = graph.getQuads(shape, util.SHACL_VALUES, null, null);
    if ( qs.length > 0 ) {
      if ( this.path !== undefined ) {
        throw new TypeError(`Property ${shape.value} has both a path and a values declaration`)
      }

      if ( qs.length > 1 ) {
        throw new TypeError(`Property ${shape.value} has multiple inferred values`)
      }

      // Parse value
      this.inferredValue = parseShaclNodeExpression(graph, qs[0].object)
    }

    if ( this.path === undefined && this.inferredValue  === undefined ) {
      throw new TypeError(`Bad property ${shape.value}`)
    }

    let grps = graph.getQuads(shape, util.SHACL_GROUP, null, null)
      .flatMap((q) => q.object instanceof N3.NamedNode ? [q.object] : [])
    this.group = null
    if (grps.length > 0) {
      this.group = this.context.getGroup(grps[0])
    }

    this.order = util.getProperty(graph, shape, util.SHACL_ORDER,
      { literal: true, expectedType: util.XSD_INTEGER }) || 10000

    let name = util.getProperty(graph, shape, util.SHACL_NAME, { literal: true, expectedType: util.XSD_STRING })
    if ( name === null ) {
      if ( this.path !== undefined ) {
        //@ts-ignore
        if ( this.path.type == 'property' ) {
          // @ts-ignore
          name = this.path.property.value
        } else {
          name = shape.value
        }
      } else  {
        throw new TypeError(`Inferred property must be named ${shape.value}`)
      }
    }
    this.name = name

    this.description = util.getProperty(graph, shape, util.SHACL_DESCRIPTION, { literal: true, expectedType: util.XSD_STRING })
    this.nodeShape = []
  }

  _connectNodes() {
    const shapes = util.getProperty(this.graph, this.shape, util.SHACL_NODE, { multiple: true })

    this.nodeShape = shapes.flatMap((t: N3.Term) => {
      if ( t.termType == 'BlankNode' ) {
        return [new NodeShape(this.graph, t, this.context)]
      } else if ( t.termType == 'NamedNode' ) {
        return [this.context?.getNode(t)]
      } else return []
    })
  }

  suggestSubject(parents: N3.Term[]): N3.Quad_Subject {
    let subject = util.getProperty(this.graph, this.shape, util.MOON_SUGGESTED_SUBJECT, { multiple: true })
    if (subject.length == 0) return N3.DataFactory.blankNode()

    for (const s of subject) {
      // Parse the subjects
      if (s.termType == 'Literal' && s.datatype.equals(util.XSD_STRING)) {
        let url: URL
        try {
          if (parents.length > 0) {
            url = new URL(s.value, parents[parents.length - 1].value)
          } else {
            url = new URL(s.value)
          }
          return N3.DataFactory.namedNode(url.href)
        } catch (e) {
          continue
        }
      } else if (s.termType == 'Literal' && s.datatype.equals(util.MOON_JAVASCRIPT_EXPR) && parents.length > 0) {
        try {
          return N3.DataFactory.namedNode((new Function("uri", s.value))(parents[parents.length - 1].value))
        } catch (e) {
          console.error("Skipped subject creation", e)
        }
      }
    }

    return N3.DataFactory.blankNode()
  }

  protected _emptyConstraint(): PropertyConstraint {
    return new PropertyConstraint()
  }
  protected _readConstraint(root: N3.Term): PropertyConstraint {
    return new PropertyConstraint(root, this.context)
  }
  protected _readChildConstraint(root: N3.Term): PropertyConstraint {
    return this._readConstraint(root)
  }

  isLazy(): boolean {
    const lazy = util.getProperty(this.graph, this.shape, util.MOON_LAZY, {literal: true, expectedType: util.XSD_BOOLEAN})
    return lazy !== null && lazy;
  }

  isAggregateView(): boolean {
    const isAgg = util.getProperty(this.graph, this.shape, util.MOON_AGGREGATE_VIEW, {literal: true, expectedType: util.XSD_BOOLEAN})
    return isAgg !== null && isAgg;
  }

  get editable(): boolean {
    let editable = this._editable
    if (editable === undefined) {
      editable = util.getProperty(this.graph, this.shape, util.MOON_EDITABLE,
        { literal: true, expectedType: util.XSD_BOOLEAN })
      if (editable === null || editable === undefined)
        editable = true;
      this._editable = editable;
    }
    return editable
  }

  getViewer(editing: boolean): N3.Term | null {
    const viewer = util.getProperty(this.graph, this.shape, editing ? util.DASH_EDITOR : util.DASH_VIEWER)
    if (editing && this.getRestrictedClasses() !== null && viewer === null) {
      return DASH_INSTANCES_SELECT_EDITOR
    }
    return viewer
  }

  getHidden() {
    return util.getProperty(this.graph, this.shape, util.MOON_HIDDEN, {literal: true, expectedType: util.XSD_BOOLEAN}) || false
  }

  getJsonProperty(): string | null {
    if ( this._jsonProperty !== undefined ) {
      return this._jsonProperty;
    } else {
      const prop = util.getProperty(this.graph, this.shape, util.MOON_JSON_PROPERTY, {literal: true, expectedType: util.XSD_STRING})
      this._jsonProperty = prop
      return prop
    }
  }

  foldConditionsSet<X>(get: (c: PropertyConstraint) => Set<X> | null): Set<X> | null {
    function orcb(left: Set<X>|null, right:Set<X>|null): Set<X>|null {
      if ( left === null || right === null ) {
        return null;
      } else {
        const ret = new Set<X>()
        for ( const a of left.values() ) ret.add(a)
        for ( const b of right.values() ) ret.add(b)
        return ret
      }
    }
    return this.foldConditions<Set<X> | null>({
      orcb,
      andcb: (left, right) => {
        if ( left === null ) return right
        else if ( right === null ) return left
        else {
          const ret = new Set<X>()
          for ( const a of left.values() ) {
            if ( right.has(a) )
              ret.add(a)
          }
          return ret
        }
      },
      xonecb: orcb,
      notcb: () => null,
      singlecb: get,
      orunit: null, andunit: null, xoneunit: null
    })
  }

  foldConditionsBool(singlecb: (c: PropertyConstraint) => boolean): boolean {
    return this.foldConditions<boolean>({
      orunit: false, andunit: true, xoneunit: false,
      orcb: (a, b) => a || b,
      andcb: (a, b) => a && b,
      xonecb: (a, b) => a || b,
      singlecb,
      notcb: (a) => !a
    })
  }

  private _getRestriction(predicate: N3.Term | N3.Term[]): string[] | null {
    const set = this.foldConditionsSet<string>((c) => {
      if ( c.shape === undefined ) return new Set<string>()
      const clss: N3.Term[] = util.getProperty(this.graph, c.shape, predicate, {multiple: true})
      if ( clss.length == 0 ) return null;
      return new Set(clss.filter((c) => c instanceof N3.NamedNode).map((c) => c.value))
    })
    if ( set === null ) return null
    else return Array.from(set)
  }

  getRestrictedClasses(): string[] | null {
    return this._getRestriction(util.SHACL_CLASS)
  }

  getRestrictedRootClasses(): string[] | null {
    return this._getRestriction(util.DASH_ROOT_CLASS)
  }

  getRestrictedValues(): string[] | null {
    return this._getRestriction(util.SHACL_IN)
  }

  mustBeIRI(): boolean {
    return this.foldConditionsBool((c) => {
      if ( c.shape === undefined ) return false
      return this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, util.SHACL_IRI, null).length > 0
    })
  }

  isSingleLine(): boolean {
    return this.graph.getQuads(this.shape, util.DASH_SINGLE_LINE, util.RDF_TRUE, null).length > 0
  }

  isMultiLine(): boolean {
    return this.graph.getQuads(this.shape, util.DASH_SINGLE_LINE, util.RDF_TRUE, null).length == 0
  }

  canBeLiteral(): boolean {
    return this.foldConditionsBool((c) => {
      if ( c.shape === undefined ) return true
      // c can be a literal if either it's explicitly declared as such, or there are no NODE_KINDS
      if ( this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, null, null).length == 0 ) return true
      return this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, util.SHACL_LITERAL, null).length > 0
    })
  }

  canBeLiteralWithType(type: N3.NamedNode): boolean {
    return this.foldConditionsBool((c) => {
      if ( c.shape === undefined ) return true
      // c can be a literal if either it's explicitly declared as such, or there are no NODE_KINDS
      if ( this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, null, null).length == 0 ) {
        if ( this.graph.getQuads(c.shape, util.SHACL_DATATYPE, null, null).length > 0 ) {
          return this.graph.getQuads(c.shape, util.SHACL_DATATYPE, type, null).length > 0
        } else {
          return true;
        }
      } else if ( this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, util.SHACL_LITERAL, null).length > 0 ) {
        return this.graph.getQuads(c.shape, util.SHACL_DATATYPE, type, null).length > 0
      } else {
        return false
      }
    })
  }

  mustBeLiteral(): boolean {
    return this.foldConditionsBool((c) => {
      // c is a required literal if there's only one nodekind declaration and it's for Literal
      if ( c.shape === undefined ) return false;

      return this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, util.SHACL_LITERAL, null).length > 0 &&
        this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, null, null).length == 1
    })
  }

  mustBeLiteralWithType(type: N3.NamedNode): boolean {
    return this.foldConditionsBool((c) => {
      // c is a required literal if there's only one nodekind declaration and it's for Literal
      if ( c.shape === undefined ) return false;

      const nodeKinds = this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, null, null).length
      if ( nodeKinds > 1 ) {
        return false;
      }

      if ( nodeKinds == 1 &&
        this.graph.getQuads(c.shape, util.SHACL_NODE_KIND, util.SHACL_LITERAL, null).length == 0
      ) {
        return false
      }

      return this.graph.getQuads(c.shape, util.SHACL_DATATYPE, type, null).length > 0
    })
  }

  getNode(): NodeShape | null {
    let nodes: N3.Term[] = []
    this.walkAllConditions((c, negated) => {
      if (negated) return
      if (c.node !== undefined)
        nodes.push(c.node)
    })
    if (nodes.length == 0) return null
    return NodeShape.conjunction(nodes.flatMap((n) => {
      if (n instanceof N3.NamedNode ||
        n instanceof N3.BlankNode) {
          return [this.context.getNode(n)]
        } else {
          return []
        }
    }))
  }

  getName(): string {
    let ret = util.getProperty(this.graph, this.shape, util.SHACL_NAME, { literal: true, expectedType: util.XSD_STRING })
    if ( ret !== null ) return ret;
    if ( this.path !== undefined ) return pathToSparql(this.path);
    else return this.shape.value
  }

  getCreatable(): boolean {
    return this.foldConditionsBool((c) => {
      if ( c.shape === undefined ) return false;

      let creatable = util.getProperty(this.graph, c.shape, util.MOON_ALLOW_CREATE, {literal: true, expectedType: util.XSD_BOOLEAN})
      if ( creatable === null ) { return false; }
      return creatable
    })
  }

  getCountLimits(): [number | null, number | null] {
    const shape = this
    return this.foldConditions<[number | null, number | null]>({
      orunit: [null, null],
      andunit: [null, null],
      xoneunit: [null, null],

      notcb: (n) => [null, null],
      singlecb: (c: PropertyConstraint) => {
        if (c.shape !== undefined) {
          let min = util.getProperty(shape.graph, c.shape, util.SHACL_MIN_COUNT, { literal: true, expectedType: util.XSD_INTEGER })
          let max = util.getProperty(shape.graph, c.shape, util.SHACL_MAX_COUNT, { literal: true, expectedType: util.XSD_INTEGER })
          return [min, max]
        } else {
          return [null, null]
        }
      },

      andcb: ([aMin, aMax], [bMin, bMax]) => {
        const min = aMin === null ? bMin : bMin === null ? aMin : Math.max(aMin, bMin);
        const max = aMax === null ? bMax : bMax === null ? aMax : Math.min(aMax, bMax);
        return [min, max]
      },
      orcb: ([aMin, aMax], [bMin, bMax]) => {
        const min = aMin === null ? bMin : bMin === null ? aMin : Math.min(aMin, bMin);
        const max = aMax === null ? bMax : bMax === null ? aMax : Math.max(aMax, bMax);
        return [min, max]
      },
      xonecb: ([aMin, aMax], [bMin, bMax]) => {
        const min = aMin === null ? bMin : bMin === null ? aMin : Math.min(aMin, bMin);
        const max = aMax === null ? bMax : bMax === null ? aMax : Math.max(aMax, bMax);
        return [min, max]
      }
    })
  }

}

export class NodeConstraint extends BaseConstraint {
  rdfClass: N3.Term | null
  closed: boolean
  ignoredProperties: N3.Term[]

  properties: PropertyShape[]

  constructor(t?: N3.Term, context?: ShapeContext) {
    super()

    this.rdfClass = null
    this.properties = []
    this.closed = false
    this.ignoredProperties = []

    if (t !== undefined && context !== undefined) {
      this._fromTerm(t, context)
    }
  }

  private _fromTerm(t: N3.Term, context: ShapeContext) {
    function _get(p: N3.Term, multiple: boolean = false): (typeof multiple extends true ? (N3.Term[]) : (N3.Term | null)) {
      const quads = context.graph.getQuads(t, p, null, null)
      if (multiple) {
        // @ts-ignore
        return quads.map((q) => q.object)
      } else if (quads.length == 0) return null
      else return quads[0].object
    }

    this.rdfClass = _get(util.SHACL_CLASS)
    const closed = _get(util.SHACL_CLOSED)
    if (closed !== null && closed.equals(util.RDF_TRUE))
      this.closed = true;
    // @ts-ignore
    this.ignoredProperties = _get(util.SHACL_IGNORED_PROPERTIES, true).flatMap((q) => {
      const l = util.listFromRdf(context.graph, q)
      if (l === null) return []
      else return []
    })
    // @ts-ignore
    this.properties = _get(util.SHACL_PROPERTY, true).flatMap((q) => {
      if (q instanceof N3.NamedNode || q instanceof N3.BlankNode) {
        console.log("LOOKUP PROPERTY", q, "of", t.value)
        try {
          return [context.getProperty(q)] //[new PropertyShape(context.graph, q, context)]
        } catch ( e ) {
          if ( e instanceof TypeError ) {
            console.warn("IGNORING", q.value, e)
            return []
          } else {
            throw e
          }
        }
      } else {
        return []
      }
    })
  }

  isEmpty() {
    return this.properties.length == 0 &&
      this.rdfClass === null &&
      !this.closed &&
      this.ignoredProperties.length == 0
  }
}

export class PropertyConstraint extends BaseConstraint {
  node?: N3.Term
  shape?: N3.Term

  constructor(t?: N3.Term, context?: ShapeContext) {
    super()

    if (t !== undefined && context !== undefined) {
      this._fromTerm(t, context)
    }
  }

  private _fromTerm(t: N3.Term, context: ShapeContext) {
    let qs = context.graph.getQuads(t, util.SHACL_NODE, null, null)
    if (qs.length > 0) {
      this.node = qs[0].object
    }

    this.shape = t
  }

  isEmpty() {
    return this.node === undefined && this.shape === undefined
  }

  //
  //  classes: N3.Term[], // Acceptable classes for this property
  //  nodeKind: NodeKinds,
  //  minCount?: number,
  //  maxCount?: number,
  //
  //  minExclusive?: N3.Literal,
  //  minInclusive?: N3.Literal,
  //  maxExclusive?: N3.Literal,
  //  maxInclusive?: N3.Literal,
  //
  //  minLength?: number,
  //  maxLength?: number,
  //
  //  pattern?: string,
  //  languageIn?: string[],
  //
  //  uniqueLang?: boolean,
  //
  //  equals?: N3.Term[],
  //  disjoint?: N3.Term[],
  //
  //  lessThan?: (N3.Literal | ShaclPath)[],
  //  lessThanOrEquals?: (N3.Literal | ShaclPath)[],
  //
  //  hasValue?: N3.Term[],
  //  oneOf?: N3.Term[] // sh:in

  // TODO sh:node, sh:property, qualifiedValueShape/MinCount/MaxCount, SPARQL-based constraints
}


