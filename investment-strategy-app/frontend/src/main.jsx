import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import Instrument from './components/InstrumentList.jsx'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Instrument />
  </StrictMode>,
)

