type BoardDefinition = {
  id: string
  label: string
  pins: {
    left: string[]
    right: string[]
  }
  image?: string
}

const createBoardIllustration = (baseColor: string, accentColor: string, labelText: string) => {
  const svg = `
<svg width="320" height="480" viewBox="0 0 320 480" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="320" height="480" rx="28" fill="${baseColor}" />
  <rect x="20" y="24" width="22" height="432" rx="10" fill="${accentColor}" opacity="0.85" />
  <rect x="278" y="24" width="22" height="432" rx="10" fill="${accentColor}" opacity="0.85" />
  <rect x="70" y="60" width="180" height="120" rx="18" fill="#0f172a" stroke="#475569" stroke-width="4" />
  <rect x="90" y="210" width="140" height="200" rx="20" fill="#020617" stroke="#475569" stroke-width="4" />
  <rect x="120" y="430" width="80" height="22" rx="12" fill="#111" stroke="${accentColor}" stroke-width="3" />
  <circle cx="160" cy="380" r="26" fill="#111827" stroke="${accentColor}" stroke-width="6" />
  <text x="160" y="268" font-size="32" font-family="sans-serif" fill="#e2e8f0" text-anchor="middle">${labelText}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const boardIllustrations = {
  wroom32: createBoardIllustration('#1f2937', '#3b82f6', 'ESP32'),
  esp32s3_devkitc_1: createBoardIllustration('#0f172a', '#a855f7', 'ESP32-S3'),
}

const espBoards: Record<string, BoardDefinition> = {
  wroom32: {
    id: 'ESP32',
    label: 'ESP32-WROOM-32',
    image: boardIllustrations.wroom32,
    pins: {
      left: ['3V3', 'GND', 'EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33', 'GPIO25', 'GPIO26'],
      right: ['GPIO27', 'GPIO14', 'GPIO12', 'GPIO13', 'GPIO23', 'GPIO22', 'GPIO1_TX', 'GPIO3_RX', 'GPIO21_SDA', 'GPIO22_SCL'],
    },
  },
  esp32s3_devkitc_1: {
    id: 'ESP32S3',
    label: 'ESP32-S3-DevKitC-1',
    image: boardIllustrations.esp32s3_devkitc_1,
    pins: {
      // pinout simplified for schematic usage
      left: [
        '3V3',
        'GND',
        'EN',
        'GPIO1',
        'GPIO2',
        'GPIO3',
        'GPIO4',
        'GPIO5',
        'GPIO6',
        'GPIO7',
        'GPIO8',
        'GPIO9',
        'GPIO10',
        'GPIO11',
        'GPIO12',
        'GPIO13',
        'GPIO14',
        'GPIO15',
      ],
      right: ['GPIO16', 'GPIO17', 'GPIO18', 'GPIO19', 'GPIO20', 'GPIO21', 'GPIO38', 'GPIO39', 'GPIO40', 'GPIO41'],
    },
  },
}

const mapPins = (pinNames: string[]) => {
  return pinNames.map((name) => ({
    name,
    type: name.startsWith('GPIO') ? 'gpio' : 'power',
  }))
}

const detectBoardDefinition = (esp32Config: any): BoardDefinition => {
  const boardName: string = esp32Config?.board || ''
  const variant: string = esp32Config?.variant || ''

  if (variant === 'esp32s3' || boardName.includes('esp32-s3-devkitc-1')) {
    return espBoards.esp32s3_devkitc_1
  }

  return espBoards.wroom32
}

export const buildESPBoardComponents = (esp32Config: any): any[] => {
  const boardDef = detectBoardDefinition(esp32Config)
  const boardName: string = esp32Config?.board || ''
  const variant: string = esp32Config?.variant || ''
  const boardImage = esp32Config?.image || boardDef.image

  return [
    {
      type: 'device',
      id: boardDef.id,
      label: boardDef.label,
      category: 'esp-board',
      meta: {
        kind: 'esp-board',
        raw: {
          board: boardName,
          variant,
        },
        image: {
          src: boardImage,
          style: {
            width: '60%',
          }
        },
      },
      center: true,
      pins: {
        left: mapPins(boardDef.pins.left),
        right: mapPins(boardDef.pins.right),
      },
    },
  ]
}
