import React from 'react'

export interface NetworkOption {
  id: string
  name: string
  description: string
  icon: string
  Component: React.FC<{ onCreated: (data?: any) => void, onBack?: () => void }>
}

// Re-exporta desde cada extensión
import { virtualAgentsOption } from '../../boards/networkOption'
import { tasksOption } from '../../apis/networkOption'
import { devicesOption } from '../../esphome/networkOption'
import { androidOption } from '../../android/networkOption'
import { objectsOption } from '../../objects/networkOption'
import { desktopOption } from '../../desktop/networkOption'
import { raspberryPiOption } from '../../raspberrypi/networkOption'

export const networkOptions: NetworkOption[] = [
  androidOption,
  desktopOption,
  devicesOption,
  raspberryPiOption,
  objectsOption,
  virtualAgentsOption,
  tasksOption,
]

