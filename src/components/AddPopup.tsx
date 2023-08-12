import { createContext, useContext } from 'react'
import { type PropertyShape } from '../common/shacl'
import N3 from 'n3';

export type AddCallback = (ns: N3.NamedNode[] | N3.NamedNode) => void

interface AddPopup {
  openAddPopup(p: PropertyShape, cb: AddCallback): void
}

export const AddPopupContext = createContext<AddPopup>({
  openAddPopup(p: PropertyShape, cb: AddCallback) {
  }
});

export function useAddPopupContext() {
  return useContext(AddPopupContext)
}
