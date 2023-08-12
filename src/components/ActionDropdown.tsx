import { Button, Dropdown } from "react-bootstrap";
import { useSparql } from "../sparql/Provider";
import { Actions, runAction } from "./Actions";
import N3 from 'n3'

interface Props {
  actions: Actions,
  focusNode: N3.Term
}

export default function ActionDropdown({actions, focusNode}: Props) {
  const { dataset } = useSparql()
  if ( actions.button === undefined || actions.button?.length == 0 ) {
    return <></>
  }

  if ( actions.button.length == 1 ) {
    const action = actions.button[0]
    return <Button variant="primary" onClick={() => runAction(dataset, action, [], {focusNode})}>
      {action.label || action.iri}
    </Button>
  }

  const items = actions.button.map((action) => {
    function trigger() {
      runAction(dataset, action, [], {focusNode})
    }
    return <Dropdown.Item onClick={trigger}>{action.label || action.iri}</Dropdown.Item>
  })
  return <Dropdown>
    <Dropdown.Toggle variant="primary">Actions</Dropdown.Toggle>
    <Dropdown.Menu>
      {items}
    </Dropdown.Menu>
  </Dropdown>
}
