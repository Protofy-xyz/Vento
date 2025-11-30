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

export const networkOptions: NetworkOption[] = [
  androidOption,
  devicesOption,
  virtualAgentsOption,
  tasksOption,
]

