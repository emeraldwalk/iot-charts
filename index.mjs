const SENSOR_LABELS = {
  'sensor.atc_fe05_temperature': 'Garage Temp',
  'sensor.atc_bb8c_temperature': 'Bunny Temp',
  'sensor.blue1dht22temp': 'Shed Temp (outside)',
  'sensor.sonoff_snzb_02d_f1f36efe_temperature': 'Greenhouse Temp',
}

async function fetchData(pageNumber = 1) {
  const url = `https://ball-started.pockethost.io/api/collections/sensor/records?page=${pageNumber}&perPage=500&sort=-created`

  const response = await fetch(url)
  const json = await response.json()

  console.log('Data:', json)

  return json.items
}

export async function createPlot() {
  const items = (
    await Promise.all([1, 2, 3, 4, 5, 6].map(fetchData))
  ).flat()

  // const data = Object.groupBy(json.items, ({ entity_id }) => entity_id)

  const data = items.reduce((memo, item) => {
    memo[item.entity_id] = memo[item.entity_id] ?? []
    memo[item.entity_id].push(item)

    return memo
  }, {})

  const tempSensorIds = Object.keys(data).filter((sensorId) =>
    sensorId.includes('temp'),
  )

  console.log('Temp sensors:', tempSensorIds)

  const traces = tempSensorIds.map((sensorId) => ({
    x: data[sensorId].map(({ created }) => dateStr(new Date(created))),
    y: data[sensorId].map(({ data }) => data),
    name: SENSOR_LABELS[sensorId] ?? sensorId,
    mode: 'lines',
    connectgaps: true,
  }))

  console.log('traces:', traces)

  const chartEl = document.getElementById('tester')
  Plotly.newPlot(chartEl, traces, {
    margin: { t: 0 },
    legend: { orientation: 'h' },
    xaxis: {
      tickformat: '%I:%M %p',
    },
    // yaxis: { range: [0, 100] },
  })
}

/** @param date {Date} */
function dateStr(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}
