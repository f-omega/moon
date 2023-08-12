import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { BsPencilFill, BsX } from 'react-icons/bs'
import { useGraphPatchEditor } from '../graph'
import { useNav } from '../nav'
import ResourceHeader from './ResourceHeader'
import ResourceViewer from './ResourceViewer'

interface Props {
  resource?: string,
  creating?: boolean,
  updateTermUri?: (newIri: string) => void,
}

export default function Resource({resource, creating, updateTermUri}: Props) {
  const [ editing, setEditing ] = useState<boolean>(false)
  const { goBack } = useNav()

  let menu = <>
    <Button variant="primary" onClick={() => {setEditing(true)}}>
      <BsPencilFill/>{' '}
      Edit
    </Button>
  </>
  if ( creating ) {
    menu = <>
      <Button variant="danger" onClick={() => { goBack() }}>
        <BsX/>{' '}
        Cancel
      </Button>
    </>
  }

  const graphEditor = useGraphPatchEditor()

  return <>
    <ResourceHeader creating={creating||false} resource={resource} menu={menu} onResourceChanged={updateTermUri}/>

    <ResourceViewer resource={resource || ""} creating={creating || false}
      editing={editing} onSaved={() => setEditing(false)} graphEditor={graphEditor} updateTermUri={updateTermUri}/>
  </>
}
