import { Form, Modal, Button } from 'react-bootstrap'
import { useState } from 'react'

export interface Props {
  onChoose(endpoint: string, graph: string): void
}

export default function GraphChooser({onChoose}: Props) {
  const [ endpoint, setEndpoint ] = useState<string>("")
  const [ graph, setGraph ] = useState<string>("")

  return <Modal show>
    <Modal.Header>
      Choose Graph
    </Modal.Header>
    <Modal.Body>
      <p>The server did not send a default graph or endpoint. Please choose one now.</p>
      <Form.Group>
        <Form.Label>Endpoint</Form.Label>
        <Form.Control placeholder="SPARQL endpoint" onChange={(e) => setEndpoint(e.target.value)}/>
      </Form.Group>
      <Form.Group>
        <Form.Label>Graph</Form.Label>
        <Form.Control placeholder="Graph" onChange={(e) => setGraph(e.target.value)}/>
        <Form.Text className="text-sm">
          Leave blank to use the default graph for the SPARQL endpoint.
        </Form.Text>
      </Form.Group>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="primary" onClick={() => onChoose(endpoint, graph)}>Okay</Button>
    </Modal.Footer>
  </Modal>
}
