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
import { devicesOption } from '../../devices/networkOption'
import { androidOption } from '../../android/networkOption'
import { objectsOption } from '../../objects/networkOption'
import { desktopOption } from '../../desktop/networkOption'

export const networkOptions: NetworkOption[] = [
  androidOption,
  desktopOption,
  devicesOption,
  objectsOption,
  virtualAgentsOption,
  tasksOption,
]

