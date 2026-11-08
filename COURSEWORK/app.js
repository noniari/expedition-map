const map = L.map('map', {
  center: [-72, 165],
  zoom: 2,
  minZoom: 1,
  maxZoom: 9,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 120,
  scrollWheelZoom: true,
  maxBounds: [[-85.051129, -180], [85.051129, 180]],
  maxBoundsViscosity: 1,
})

const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
  subdomains: 'abc',
  maxZoom: 19,
  noWrap: true,
  updateWhenIdle: true,
  keepBuffer: 1,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a>',
})

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

const expeditionList = document.querySelector('#expedition-list')
const expeditionDetails = document.querySelector('#expedition-details')
let expeditionLayer
let expeditionGeoJSON

fetch('./expeditions.geojson')
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Не удалось загрузить данные: ${response.status}`)
    }
    return response.json()
  })
  .then((geojson) => {
    expeditionGeoJSON = geojson
    const routes = geojson.features.filter((feature) => feature.properties.kind === 'route')

    if (routes.length === 0) {
      throw new Error('В GeoJSON не найдены экспедиции с маршрутами.')
    }

    expeditionList.replaceChildren()

    routes.forEach((route, index) => {
      const { expeditionId, name, region, period } = route.properties
      const button = document.createElement('button')
      button.className = 'expedition-option'
      button.type = 'button'
      button.setAttribute('aria-pressed', 'false')

      const title = document.createElement('span')
      title.className = 'expedition-option-title'
      title.textContent = name

      const metadata = document.createElement('span')
      metadata.className = 'expedition-option-meta'
      metadata.textContent = `${region} · ${period}`

      button.append(title, metadata)
      button.addEventListener('click', () => selectExpedition(expeditionId, button))
      expeditionList.append(button)

      if (index === 0) {
        selectExpedition(expeditionId, button)
      }
    })
  })
  .catch((error) => {
    console.error(error)
    expeditionList.textContent = 'Не удалось загрузить экспедиции.'
    baseLayer.addTo(map)
  })

function selectExpedition(expeditionId, selectedButton) {
  const features = expeditionGeoJSON?.features
  if (!features) return

  expeditionList.querySelectorAll('.expedition-option').forEach((button) => {
    button.setAttribute('aria-pressed', String(button === selectedButton))
  })

  const selectedFeatures = features.filter((feature) => feature.properties.expeditionId === expeditionId)
  const route = selectedFeatures.find((feature) => feature.properties.kind === 'route')
  if (!route) return

  expeditionLayer?.remove()
  expeditionLayer = L.geoJSON({ type: 'FeatureCollection', features: selectedFeatures }, {
    style: (feature) => ({
      color: feature.properties.color || '#c14f32',
      weight: 4,
      opacity: 0.9,
    }),
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: feature.properties.color || '#087e83',
      fillOpacity: 1,
    }),
    onEachFeature: (feature, layer) => {
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = feature.properties.title || feature.properties.name
      popup.append(title)

      if (feature.properties.date) {
        const date = document.createElement('p')
        date.textContent = feature.properties.date
        popup.append(date)
      }

      if (feature.properties.description) {
        const description = document.createElement('p')
        description.textContent = feature.properties.description
        popup.append(description)
      }

      layer.bindPopup(popup)
    },
  }).addTo(map)

  renderExpeditionDetails(route.properties)

  map.fitBounds(expeditionLayer.getBounds(), { padding: [32, 32], maxZoom: 6, animate: false })
  if (!map.hasLayer(baseLayer)) baseLayer.addTo(map)
}

function renderExpeditionDetails(expedition) {
  const content = document.createDocumentFragment()
  const title = document.createElement('h3')
  title.className = 'detail-title'
  title.textContent = expedition.name

  const metadata = document.createElement('p')
  metadata.className = 'detail-meta'
  metadata.textContent = `${expedition.period} · ${expedition.region}`

  const description = document.createElement('p')
  description.className = 'detail-description'
  description.textContent = expedition.description
  content.append(title, metadata, description)

  const shipImage = createFigure(expedition.images.ship)
  const placeHeading = document.createElement('h4')
  placeHeading.className = 'section-title'
  placeHeading.textContent = 'Место экспедиции'
  const placeImage = createFigure(expedition.images.place)
  content.append(shipImage, placeHeading, placeImage)

  const peopleHeading = document.createElement('h4')
  peopleHeading.className = 'section-title'
  peopleHeading.textContent = 'Участники'
  const peopleList = document.createElement('div')
  peopleList.className = 'participant-list'
  const biography = document.createElement('section')
  biography.className = 'participant-biography'
  biography.id = 'participant-biography'
  biography.setAttribute('aria-live', 'polite')
  biography.hidden = true

  expedition.participants.forEach((person) => {
    const button = document.createElement('button')
    button.className = 'participant-option'
    button.type = 'button'
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-controls', biography.id)

    const portrait = document.createElement('img')
    portrait.src = person.image
    portrait.alt = person.imageAlt
    portrait.width = 44
    portrait.height = 50
    portrait.loading = 'lazy'

    const identity = document.createElement('span')
    identity.className = 'participant-identity'
    const name = document.createElement('strong')
    name.textContent = person.name
    const role = document.createElement('span')
    role.textContent = person.role
    identity.append(name, role)
    button.append(portrait, identity)

    button.addEventListener('click', () => {
      const isOpen = button.getAttribute('aria-expanded') === 'true'
      peopleList.querySelectorAll('.participant-option').forEach((option) => {
        option.setAttribute('aria-expanded', 'false')
      })
      biography.replaceChildren()
      biography.hidden = isOpen
      if (isOpen) return

      button.setAttribute('aria-expanded', 'true')
      const biographyTitle = document.createElement('h5')
      biographyTitle.textContent = person.name
      const biographyText = document.createElement('p')
      biographyText.textContent = person.biography
      const more = document.createElement('a')
      more.href = person.wikipedia
      more.target = '_blank'
      more.rel = 'noopener noreferrer'
      more.textContent = 'Подробнее...'
      const photoCredit = document.createElement('span')
      photoCredit.className = 'image-credit'
      photoCredit.textContent = 'Фото: Wikimedia Commons'
      biography.append(biographyTitle, biographyText, more, photoCredit)
      biography.hidden = false
    })
    peopleList.append(button)
  })

  content.append(peopleHeading, peopleList, biography)

  const source = document.createElement('a')
  source.className = 'data-source'
  source.href = expedition.source.url
  source.target = '_blank'
  source.rel = 'noopener noreferrer'
  source.textContent = `Источник сведений: ${expedition.source.label}`
  content.append(source)

  expeditionDetails.replaceChildren(content)
}

function createFigure(imageData) {
  const figure = document.createElement('figure')
  figure.className = 'expedition-figure'
  const image = document.createElement('img')
  image.src = imageData.src
  image.alt = imageData.alt
  image.width = imageData.width
  image.height = imageData.height
  image.loading = 'lazy'
  image.addEventListener('error', () => figure.classList.add('image-unavailable'), { once: true })

  const caption = document.createElement('figcaption')
  const description = document.createElement('span')
  description.textContent = imageData.caption
  const credit = document.createElement('span')
  credit.textContent = imageData.credit
  const article = document.createElement('a')
  article.href = imageData.wikipedia
  article.target = '_blank'
  article.rel = 'noopener noreferrer'
  article.textContent = 'Статья об экспедиции в Википедии'
  caption.append(description, credit, article)
  figure.append(image, caption)
  return figure
}
