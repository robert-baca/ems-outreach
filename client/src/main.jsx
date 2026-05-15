import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './App.css';
import 'leaflet/dist/leaflet.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Fix Leaflet default marker icons when bundled with Vite
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {CLERK_KEY ? (
        <ClerkProvider publishableKey={CLERK_KEY}>
          <App />
        </ClerkProvider>
      ) : (
        // No Clerk key set — run without auth (local dev / single-hospital mode)
        <App />
      )}
    </ErrorBoundary>
  </React.StrictMode>
);
