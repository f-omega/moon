import { Modal, Container, Alert, Navbar, Form, Button, InputGroup } from 'react-bootstrap';

import { ReactNode, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import logo from './logo.svg';
import './App.css';

import 'react-toastify/dist/ReactToastify.min.css';
import SparqlProvider, { useSparql } from './sparql/Provider'
import { NavContext } from './nav'
import { GraphContext, GraphNavigator } from './graph'
import { CacheContext, Cache } from './cache'
import Loading from './components/Loading'
import Resource from './components/Resource'
import { AddCallback, AddPopupContext } from './components/AddPopup'
import { PropertyShape } from './common/shacl'

import Select, { SingleValue } from 'react-select'

import { ToastContainer } from 'react-toastify'
import N3 from 'n3'
import streamify from 'streamify-string'
import rdfparse from 'rdf-parse'

import 'bootstrap/dist/css/bootstrap.css'
import { isSelectResult, SparqlResultContext, VarBindingResult } from './sparql/types';
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream';
import { parseVoidDatasets, type DatasetSpec } from './common/util';
import { FocusContext } from './components/FocusNode';

type AppMode = 'browse' | 'local'

interface AddPopupInfo {
    property: PropertyShape,
    addCallback: AddCallback
}

interface IAppProps extends IAppBaseProps {
    endpoint?: string,
    updateEndpoint?: string
}

interface IAppChildProps extends IAppBaseProps {
    datasets: DatasetSpec[],
    dataset: DatasetSpec | null,
    chooseDataset(ds: DatasetSpec): void
}

interface IAppBaseProps {
    initialMode?: AppMode,
}

class FetchError {
    response: Response
    constructor(r: Response) {
        this.response = r
    }

    toString() {
        return `Error fetching resource: ${this.response.status}`
    }
}

class ResourceNotFoundError {
    uri: string

    constructor(uri: string) {
        this.uri = uri
    }

    toString() {
        return `Could not find any information on resource ${this.uri}`
    }
}

function parseIntoStore(store: N3.Store, body: ReadableStream | string, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            let stream = typeof (body) == 'string' ? streamify(body) as any : body;

            rdfparse.parse(stream, { contentType: contentType })
                .on('data', (quad) => store.add(quad))
                .on('error', (error) => reject(error))
                .on('end', () => resolve())
        } catch (e) {
            reject(e)
        }
    })
}

async function loadGraph(): Promise<N3.Store> {
    const contentTypes = await rdfparse.getContentTypes()
    let found = false

    const store = new N3.Store()

    // Look for <script> tags that are RDF data and load them into the database.
    const scripts = document.getElementsByTagName('script')
    for (let i = 0; i < scripts.length; ++i) {
        if (contentTypes.indexOf(scripts[i].type) >= 0) {
            // Attempt to load this fragment into thegraph
        }
    }

    if (!found) {
        // If none found, attempt fetching the current page as one of the RDF formats
        let r = await fetch('', {
            method: 'GET',
            headers: { 'Accept': contentTypes.join(',') }
        })
        if (r.ok) {
            if (r.body === null) {
                throw new TypeError("Invalid response")
            }
            const contentType: string = r.headers.get('Content-type') || 'application/rdf+xml'
            if (contentType.startsWith("text/html")) {
                throw new ResourceNotFoundError(location.href)
            }

            await parseIntoStore(store, r.body, contentType)
        } else {
            throw new FetchError(r)
        }
    }

    return store
}

function AppChild({ initialMode, datasets, dataset, chooseDataset }: IAppChildProps) {
    const sparql = useSparql()
    const [loading, setLoading] = useState(false)
    const [effectiveMode, setEffectiveMode] = useState<AppMode>(initialMode || 'local')
    //  const [ graph, setGraph ] = useState<N3.Store>(() => new N3.Store())
    const [empty, setEmpty] = useState<boolean>(false)
    const [resource, setResource] = useState<string | null>(() => {
        if (effectiveMode == 'local') {
            return location.href
        } else {
            return new URLSearchParams(location.search).get("loc")
        }
    })
    const isCreating = useMemo(() => {
        return new URLSearchParams(location.search).has("new")
    }, [location])

    const rootGraph = useMemo(() => new GraphNavigator(), [])

    useEffect(() => {
        if (dataset === null && datasets !== null && datasets.length > 0) {
            chooseDataset(datasets[0])
        }
    }, [datasets, dataset])

    const graph = useMemo(() => resource !== null ? rootGraph.focus([resource]) : rootGraph, [resource])

    const followLink = useMemo(() => {
        function browseFollowLink(termUri: string, root?: string) {
            setResource(termUri)
            history.pushState(termUri, '', `${root || ''}?loc=${encodeURIComponent(termUri)}`)
        }

        if (effectiveMode == 'local') {
            return (termUri: string) => {
                let uri = new URL(termUri)
                if (uri.origin == location.origin) {
                    history.pushState(termUri, '', termUri)
                    //setEffectiveMode('local')
                    setResource(termUri)
                } else {
                    setEffectiveMode('browse')
                    browseFollowLink(termUri, '/') // TODO find a browser node
                }

            }
        } else {
            return browseFollowLink
        }
  }, [effectiveMode])

  function updateCreatingUri(newUri: string) {
    console.log("UPDATE CREATING", newUri)
    setResource(newUri)
  }

    const [error, setError] = useState<any>(null)

    //  useEffect(() => {
    //    if ( (initialMode || 'local') == 'local' ) {
    //      setLoading(true)
    //      loadGraph().then(setGraph)
    //        .catch(setError)
    //        .finally(() => {
    //          console.log("ENDED")
    //          setLoading(false)
    //        })
    //    }
    //
    //    if ( !loading && graph.size == 0 && resource !== null && resource !== undefined ) {
    //      // Use the SPARQL endpoint (if any to get data about the current triple)
    //      updateGraph(resource).then(() => { setLoading(false) })
    //    }
    //  }, [sparql, resource])

    useEffect(() => {
        if (isCreating) return; // Don't go anywhere if we're craeting a new resource
        if (resource === null && sparql.ready) {
            // @ts-ignore
            sparql.runSparql("SELECT ?s WHERE { ?s ?p ?o. } LIMIT 1").then((r: VarBindingResult<"s">) => {
                if (r.results.bindings.length == 0) {
                    setEmpty(true) // TODO go to some well known url that is 'create'
                } else {
                    let binding = r.results.bindings[0].s
                    if (binding.type == 'uri') {
                        followLink(binding.value)
                        setResource(binding.value)
                    } else {
                        setError(new TypeError("SPARQL endpoint returned invalid entry for s"))
                    }
                }
            }).catch((e) => {
                setError(e)
            })
        }
    }, [sparql, resource])

    useEffect(() => {
        function goBack(e: PopStateEvent) {
            const termUri = e.state
            setResource(termUri)
        }

        window.addEventListener('popstate', goBack)

        return () => {
            window.removeEventListener('popstate', goBack)
        }
    }, [])

    useEffect(() => {
        if (!isCreating)
            //      followLink(encodeURIComponent(resource || ''))
            history.replaceState(resource, '', `?loc=${encodeURIComponent(resource || '')}`)
    }, [resource, isCreating])

    let content: ReactNode = null
    if (error) {
        console.error(error)
        content = <Alert variant="danger">Could not load resource: {error.toString()}</Alert>
    } else if (isCreating) {
        content = <Container key="creating">
    <Resource creating updateTermUri={updateCreatingUri}/>
        </Container>
    } else if (!sparql.ready || resource === null) {
        content = <Loading />
    } else {
        content = <Container key={resource}>
            <Resource resource={resource} />
        </Container>
    }

    const caches = useRef<{ [x: string]: Cache }>({})
    const cache = useMemo(() => {
        if (dataset === null) {
            return new Cache()
        } else {
            if (dataset.iri in caches.current) {
                return caches.current[dataset.iri]
            } else {
                caches.current[dataset.iri] = new Cache(dataset.shapesGraph)
                return caches.current[dataset.iri]
            }
        }
    }, [dataset])

    function setDataset(newValue: SingleValue<DatasetSpec>) {
        if (newValue !== null)
            chooseDataset(newValue)
    }


    function goBack() {
        history.back();
    }

const [showAddPopup, setShowAddPopup] = useState<AddPopupInfo[]>([])

    function openAddPopup(p: PropertyShape, addCallback: AddCallback) {
  setShowAddPopup((xs) => [{ property: p, addCallback }, ...xs])
    }

    let addModal = <></>
    if (showAddPopup.length > 0) {
  addModal = <AddPopup {...showAddPopup[0]} />
    }

    return (<NavContext.Provider value={{ followLink, goBack, mode: effectiveMode, linkMode: 'auto' }}>
        <FocusContext.Provider value={resource ? [N3.DataFactory.namedNode(resource)] : []}>
            <GraphContext.Provider value={graph}>
                <CacheContext.Provider value={cache}>
                    <Navbar bg="light" expand="lg">
                        <Navbar.Brand href="/">Moon</Navbar.Brand>
                        <InputGroup>
                            <Form.Control placeholder="Search" />
                            <Button variant="secondary" className="me-3" as="a" href="?new">Add</Button>
                        </InputGroup>
                        <Select options={datasets} value={dataset} onChange={setDataset} />
                        <Navbar.Toggle aria-controls="top-navbar-nav" />
                        <Navbar.Collapse id="top-navbar-nav">
                        </Navbar.Collapse>
        </Navbar>
        <AddPopupContext.Provider value={({ openAddPopup })}>
                    {addModal}
                        {content}
                    </AddPopupContext.Provider>
                </CacheContext.Provider>
            </GraphContext.Provider>
        </FocusContext.Provider>
    </NavContext.Provider>)
}

interface PasswordRequest {
    endpoint: string,
    username: string,
    resolve(p: string): void,
    reject(e: any): void
}

class NoPasswordProvided {
    endpoint: string
    username: string
    constructor(endpoint: string, username: string) {
        this.endpoint = endpoint
        this.username = username
    }
}

function App({ endpoint, updateEndpoint, initialMode }: IAppProps) {
    const [dataset, setDataset] = useState<DatasetSpec | null>(() => {
        if (endpoint !== undefined) {
            return { iri: endpoint, name: endpoint, label: endpoint, value: endpoint, sparqlEndpoint: { endpoint, needsProxy: false } }
        }
        return null
    })
    const [datasets, setDatasets] = useState<DatasetSpec[] | null>(null)
    const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null)

    const requestPassword = useCallback((endpoint: string, username: string) => new Promise<string>((resolve, reject) => {
        const request: PasswordRequest = { endpoint, username, resolve, reject }
        const savedPassword = localStorage.getItem(passwordKey(request))
        if (savedPassword !== null) { resolve(savedPassword); return }
        setPasswordRequest((oldRequest) => {
            if (oldRequest !== null) {
                oldRequest.reject(new NoPasswordProvided(oldRequest.endpoint, oldRequest.username))
            }
            return request
        })
    }), []);

    useEffect(() => {
        if (datasets !== null) return

        fetch('/.well-known/void').then(async (r) => {
            let contentType = r.headers.get('Content-type') || 'text/turtle'
            if (contentType.indexOf(';') >= 0) {
                contentType = contentType.substring(0, contentType.indexOf(';'))
            }

            const graph = new N3.Store()
            await new Promise((resolve, reject) => {
                rdfparse.parse(new ReadableWebToNodeStream(r.body as any) as any, { contentType })
                    .on('data', (quad) => graph.add(quad))
                    .on('error', reject)
                    .on('end', resolve)
            })

            const parsedDatasets = parseVoidDatasets(graph)

            setDatasets(parsedDatasets)
        }).catch((e) => { console.error(e) })
    }, [])

    if (datasets === null) {
        return <Loading />
    } else {
        return (
            <SparqlProvider key={dataset?.iri || "main"}
                getPassword={requestPassword}
                spec={dataset || undefined}>
                {passwordRequest ? <PasswordRequestModal request={passwordRequest} onDone={() => setPasswordRequest(null)} /> : <></>}
                <AppChild initialMode={initialMode} datasets={datasets} dataset={dataset} chooseDataset={(ds) => setDataset(ds)} />
                <ToastContainer position="bottom-left" />
            </SparqlProvider>
        );
    }
}


interface PasswordRequestProps {
    request: PasswordRequest,
    onDone(): void
}

function passwordKey(request: PasswordRequest) {
    return `pw-${request.endpoint}-${request.username}`
}

function doSavePassword(request: PasswordRequest, pw: string) {
    localStorage.setItem(passwordKey(request), pw)
}

function PasswordRequestModal({ request, onDone }: PasswordRequestProps) {
    const [password, setPassword] = useState<string>("")
    const [savePassword, setSavePassword] = useState<boolean>(true)

    return <Modal show>
        <Modal.Header>Password</Modal.Header>
        <Modal.Body>
            <p>The SPARQL endpoint '{request.endpoint}' needs authentication to proceed</p>
            <Form.Group>
                <Form.Label>Username</Form.Label>
                <Form.Control disabled defaultValue={request.username} />
            </Form.Group>
            <Form.Group>
                <Form.Label>Password</Form.Label>
                <Form.Control autoFocus type="password" placeholder="Password" onChange={(e) => setPassword(e?.target?.value || "")} />
            </Form.Group>
            <Form.Switch label="Save Password" checked={savePassword} onChange={(e) => setSavePassword(e.target.checked)} />
        </Modal.Body>
        <Modal.Footer>
            <Button onClick={() => { request.reject(new NoPasswordProvided(request.endpoint, request.username)); onDone() }} variant="secondary">Cancel</Button>
            <Button onClick={() => { request.resolve(password); if (savePassword) doSavePassword(request, password); onDone() }} variant="primary">Okay</Button>
        </Modal.Footer>
    </Modal>
}

  function AddPopup({property, addCallback}: AddPopupInfo) {
return <Modal show>
<Modal.Header>Add</Modal.Header>
  <Modal.Body>
  <Resource creating/>
  </Modal.Body>
  <Modal.Footer>
  </Modal.Footer>
  </Modal>
  }

export default App;
