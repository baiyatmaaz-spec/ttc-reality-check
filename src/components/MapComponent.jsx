import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import { collection, addDoc, onSnapshot, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const TORONTO_CENTER = [43.7731, -79.2582]
const ZOOM = 12

function getColor(count) {
  if (count >= 5) return '#ef4444'
  if (count >= 2) return '#eab308'
  return '#22c55e'
}

function ClickCapture({ onMapClick, active }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng)
    },
  })
  return null
}

export default function MapComponent() {
  const [reports, setReports] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [pendingLatLng, setPendingLatLng] = useState(null)
  const [routeName, setRouteName] = useState('')
  const [reportType, setReportType] = useState('delay')
  const [submitting, setSubmitting] = useState(false)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const cutoff = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000)
    const q = query(
      collection(db, 'reports'),
      where('created_at', '>=', cutoff)
    )
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const handleMapClick = useCallback((latlng) => {
    if (!pickingLocation) return
    setPendingLatLng(latlng)
    setPickingLocation(false)
    setShowModal(true)
  }, [pickingLocation])

  const handleReportButton = () => {
    setPickingLocation(true)
    showToast('Tap anywhere on the map to pin your report')
  }

  const handleSubmit = async () => {
    if (!pendingLatLng) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'reports'), {
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
        type: reportType,
        route_name: routeName.trim() || null,
        created_at: Timestamp.now(),
      })
      setShowModal(false)
      setRouteName('')
      setReportType('delay')
      setPendingLatLng(null)
      showToast('Report submitted! Thanks 🚌')
    } catch (err) {
      console.error(err)
      showToast('Error submitting — try again')
    }
    setSubmitting(false)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-900 bg-opacity-90 text-white px-4 py-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">🚌 Scarborough Transit Truth</h1>
          <p className="text-xs text-gray-400">Unofficial community delay map</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1"></span>Live
        </div>
      </div>

      <div className="absolute bottom-24 left-3 z-10 bg-gray-900 bg-opacity-85 text-white rounded-xl px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> 0–1 reports</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> 2–4 reports</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> 5+ reports</div>
        <div className="text-gray-400 pt-1">Reports expire after 60 min</div>
      </div>

      <div className="absolute top-16 right-3 z-10 bg-gray-900 bg-opacity-85 text-white rounded-xl px-3 py-2 text-xs text-center">
        <div className="text-xl font-bold text-red-400">{reports.length}</div>
        <div className="text-gray-400">active reports</div>
      </div>

      <MapContainer center={TORONTO_CENTER} zoom={ZOOM} className="h-screen w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onMapClick={handleMapClick} active={pickingLocation} />
        {reports.map(r => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={14}
            pathOptions={{
              color: getColor(reports.filter(x =>
                Math.abs(x.lat - r.lat) < 0.003 && Math.abs(x.lng - r.lng) < 0.003
              ).length),
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{r.type === 'delay' ? '🕐 Delay' : '⚠️ Outage'}</strong>
                {r.route_name && <div>Route: <strong>{r.route_name}</strong></div>}
                <div className="text-gray-500 text-xs mt-1">
                  {new Date(r.created_at?.seconds * 1000).toLocaleTimeString()}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <button
        onClick={handleReportButton}
        className={`absolute bottom-8 right-4 z-10 px-5 py-4 rounded-full text-white font-bold text-sm shadow-lg transition-all ${
          pickingLocation
            ? 'bg-yellow-500 animate-pulse'
            : 'bg-red-600 hover:bg-red-700 active:scale-95'
        }`}
      >
        {pickingLocation ? '📍 Tap the map...' : '⚠️ Report Delay'}
      </button>

      {toast && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {showModal && (
        <div className="absolute inset-0 z-20 flex items-end justify-center pb-8 px-4 bg-black bg-opacity-40">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-3 text-gray-800">📍 Report Details</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setReportType('delay')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  reportType === 'delay' ? 'bg-red-500 text-white border-red-500' : 'border-gray-300 text-gray-600'
                }`}
              >
                🕐 Delay
              </button>
              <button
                onClick={() => setReportType('outage')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                  reportType === 'outage' ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-600'
                }`}
              >
                ⚠️ Outage
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route (optional)</label>
            <input
              type="text"
              placeholder="e.g. 54 Lawrence, 86 Scarborough"
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowModal(false); setPendingLatLng(null) }}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
