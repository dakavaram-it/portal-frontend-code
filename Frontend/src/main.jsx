import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'

// No StrictMode: its dev-only double-invoke of effects (mount, unmount, remount) was
// showing up as a second, aborted network call for every screen that loads data on
// mount — real behavior (the request really is cancelled, not a failure), but it read
// as an error in the Network tab. Production builds never ran StrictMode's checks
// anyway, so this only changes what the dev server shows, not the deployed app.
createRoot(document.getElementById('root')).render(<App />)
