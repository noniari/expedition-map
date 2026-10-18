const map = L.map('map', {
  center: [20, 10],
  zoom: 2,
  minZoom: 2,
  maxZoom: 9,
  scrollWheelZoom: true,
  worldCopyJump: true,
})

L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.fossgis.de/">FOSSGIS</a>',
}).addTo(map)

let coordinateReadout

const coordinateControl = L.control({ position: 'bottomleft' })
coordinateControl.onAdd = () => {
  coordinateReadout = L.DomUtil.create('div', 'coordinate-readout')
  coordinateReadout.setAttribute('aria-label', 'Координаты выбранной точки: широта, долгота')
  coordinateReadout.setAttribute('aria-live', 'polite')
  coordinateReadout.textContent = 'Координаты: —'
  return coordinateReadout
}
coordinateControl.addTo(map)

L.control.scale({ imperial: false }).addTo(map)

map.on('click', ({ latlng }) => {
  coordinateReadout.textContent = `Ш: ${latlng.lat.toFixed(4)}° · Д: ${latlng.lng.toFixed(4)}°`
})
