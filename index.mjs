import * as d3 from 'https://cdn.jsdelivr.net/npm/d3-array@3/+esm'

const SENSOR_LABELS = {
  'sensor.atc_fe05_temperature': 'Garage Temp',
  'sensor.atc_bb8c_temperature': 'Bunny Temp',
  'sensor.blue1dht22temp': 'Shed Temp (outside)',
  'sensor.sonoff_snzb_02d_f1f36efe_temperature': 'Greenhouse Temp',
  'sensor.atc_971e_temperature': 'Shed Temp (inside)',
}

// copy of Plotly default colorway
const DEFAULT_COLORWAY = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
]

async function fetchData(pageNumber = 1) {
  const now = new Date()
  const since = new Date(now)
  since.setHours(since.getHours() - 24)
  const sinceStr = since.toISOString().replace('T', ' ') // .substring(0, 16) //.split('T')[0]
  console.log({ now: now.toISOString(), sinceStr })

  const url = `https://ball-started.pockethost.io/api/collections/sensor/records?page=${pageNumber}&perPage=500&sort=-created&filter=${encodeURIComponent(
    `created>='${sinceStr}'`,
  )}`

  const response = await fetch(url)
  const json = await response.json()

  console.log('Data:', json)

  return json
}

function* range(start, end) {
  for (let i = start; i <= end; ++i) {
    yield i
  }
}

export async function createPlot() {
  const { items, totalPages } = await fetchData(1)
  const maxPages = 12

  // Load remaining pages
  items.push(
    ...(
      await Promise.all(
        [...range(2, Math.min(maxPages, totalPages))].map(fetchData),
      )
    )
      .map((datum) => datum.items)
      .flat(),
  )

  const data = items.reduce((memo, item) => {
    memo[item.entity_id] = memo[item.entity_id] ?? []
    memo[item.entity_id].push(item)

    return memo
  }, {})

  const tempSensorIds = Object.keys(data)
    .filter((sensorId) => sensorId.includes('temp'))
    .sort((a, b) =>
      (SENSOR_LABELS[a] ?? a).localeCompare(SENSOR_LABELS[b] ?? b),
    )

  console.log('Temp sensors:', tempSensorIds)

  const annotations = []
  const cellData = {}

  const traces = tempSensorIds
    .map((sensorId, i) => {
      const name = SENSOR_LABELS[sensorId] ?? sensorId
      const x = data[sensorId].map(({ created }) => dateStr(new Date(created)))
      const y = data[sensorId].map(({ data }) => data)

      const minI = d3.minIndex(y)
      const maxI = d3.maxIndex(y)

      const now = { y: y[0] }
      const min = {
        x: x[minI],
        y: y[minI],
      }
      const max = {
        x: x[maxI],
        y: y[maxI],
      }
      const mean = {
        y: d3.mean(y),
      }

      annotations.push(
        {
          x: min.x,
          y: min.y,
          text: `${min.y} (min)`,
          ax: i * -20,
          // ay: -40,
        },
        {
          x: max.x,
          y: max.y,
          text: `${max.y} (max)`,
          ax: i * -20,
        },
      )

      cellData[name] = [now.y, min.y, max.y, mean.y]

      return [
        {
          x,
          y,
          name,
          mode: 'lines',
          connectgaps: true,
          line: {
            color: DEFAULT_COLORWAY[i],
            width: 1,
          },
        },
        // {
        //   x: [x[0], x.at(-1)],
        //   y: [max.y, max.y],
        //   name,
        //   mode: 'lines',
        //   showlegend: false,
        //   line: {
        //     color: DEFAULT_COLORWAY[i],
        //     dash: 'dashdot',
        //     width: 1,
        //   },
        // },
      ]
    })
    .flat()

  const tableData = {
    type: 'table',
    header: {
      values: [
        ['<b>Sensors</b>'],
        ['<b>Now</b>'],
        ['<b>Min</b>'],
        ['<b>Max</b>'],
        ['<b>Avg</b>'],
      ],
    },
    cells: {
      align: ['left', 'right', 'right', 'right'],
      values: [
        Object.keys(cellData),
        Object.values(cellData).map((datum) => datum[0]),
        Object.values(cellData).map((datum) => datum[1]),
        Object.values(cellData).map((datum) => datum[2]),
        Object.values(cellData).map((datum) => Number(datum[3].toFixed(2))),
      ],
    },
  }

  console.log('traces:', traces)

  const end = new Date()
  const start = new Date(end)
  start.setHours(start.getHours() - 12)

  const chartEl = document.getElementById('chart')
  Plotly.newPlot(
    chartEl,
    traces,
    {
      dragmode: 'pan',
      margin: { t: 32, l: 24, r: 24, b: 24 },
      legend: { orientation: 'h' },
      xaxis: {
        range: [start.getTime(), end.getTime()],
        tickformat: '%I:%M %p',
      },
      // yaxis: { range: [0, 100] },
      annotations,
    },
    { responsive: true },
  )

  const tableEl = document.getElementById('table')
  Plotly.newPlot(
    tableEl,
    [tableData],
    {
      margin: { t: 10, l: 10, r: 10, b: 10 },
    },
    { responsive: true },
  )
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
