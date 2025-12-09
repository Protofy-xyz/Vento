import dynamic from 'next/dynamic';
import { generateColorbyIndex } from 'protoflow/src/diagram/Theme';
import Wifi from './Wifi';
import Esp32dev from './Esp32dev';
import Seeed_xiao_esp32s3 from './Seeed_xiao_esp32s3';
import Esp32s3devkitc1 from './Esp32s3devkitc1';
import ProtofyESP32S3devBoard from './ProtofyESP32S3devBoard';
import Mqtt from './Mqtt';
import Relay from './Relay';
import GPIOSwitch from './GPIOSwitch';
import BinarySensor from './BinarySensor';
import NeopixelsBus from './NeopixelsBus';
import ADCSensor from './ADCSensor';
import I2cBus from './I2cBus';
import UARTBus from './UARTBus';
import PCA9685 from './PCA9685';
import EthernetRmii from './EthernetRmii';
import EthernetSpi from './EthernetSpi';
import TempHumidity from './TempHumidity';
import MicrofirePhEcTemp from './MicrofirePhEcTemp';
import HX711 from './HX711';
import A4988 from './A4988';
import MPU6050 from './MPU6050';
import SEN55 from './SEN55';
import MHZ19 from './MHZ19';
import NFCReader from './NFCReader';
import R503 from './R503';
import SCD4X from './SCD4X';
import DS18B20 from './DS18B20';
import RotaryEncoder from './RotaryEncoder';
import I2cADC_ADS1115 from './I2cADC_ADS1115';
import Servo from './Servo';
import DallasBus from './OneWireBus';
import SPIBus from './SPIBus';
import CANBusSPI from './CANBusSPI';
import MKSServo42D from './MKSServo42D';
import Msa3xx from './Msa3xx';
import ODrive from './ODrive';
import INA226 from './INA226';
import LEDCOutput from './LEDCOutput';
import SntpTime from './SntpTime';
import SdOfflineLogger from './SdOfflineLogger';
import OdriveCan from './ODriveCan'
import GM77 from './GM77'
import UltrasonicDistanceSensor from './UltrasonicDistanceSensor';
import MAX31865 from './MAX31865';
import BMP280 from './BMP280';
import NeopixelsDisplay from './NeopixelsDisplay';
import ST7789V from './ST7789V';
import Modem from './Modem';
import CANBusUART from './CANBusUART';
import I2c_MCP23008 from './I2c_MCP23008';
import SEN0377 from './SEN0377';
import AHT10 from './AHT10';
import LD2450 from './LD2450';
import MPU6050Interrupt from './MPU6050Interrupt';
import WK2168 from './WK2168';
import GPS from './GPS';
import TCS34725 from './TCS34725';
import PIDClimate from './PIDClimate';
import ProtofyXIAOESP32S3devBoard from './ProtofyXIAOESP32S3devBoard';
import KodeDot from './KodeDot';

const deviceMasks = [
  Wifi,
  Esp32dev,
  Seeed_xiao_esp32s3,
  Esp32s3devkitc1,
  ProtofyESP32S3devBoard,
  ProtofyXIAOESP32S3devBoard,
  Mqtt,
  Relay,
  GPIOSwitch,
  BinarySensor,
  NeopixelsBus,
  ADCSensor,
  I2cBus,
  UARTBus,
  PCA9685,
  EthernetRmii,
  EthernetSpi,
  TempHumidity,
  MicrofirePhEcTemp,
  HX711,
  A4988,
  MPU6050,
  SEN55,
  MHZ19,
  NFCReader,
  R503,
  SCD4X,
  DS18B20,
  RotaryEncoder,
  I2cADC_ADS1115,
  Servo,
  DallasBus,
  SPIBus,
  CANBusSPI,
  MKSServo42D,
  Msa3xx,
  ODrive,
  INA226,
  LEDCOutput,
  SntpTime,
  SdOfflineLogger,
  OdriveCan,
  GM77,
  UltrasonicDistanceSensor,
  MAX31865,
  BMP280,
  NeopixelsDisplay,
  ST7789V,
  Modem,
  CANBusUART,
  I2c_MCP23008,
  SEN0377,
  AHT10,
  LD2450,
  MPU6050Interrupt,
  WK2168,
  GPS,
  TCS34725,
  PIDClimate,
  KodeDot
]

const masksLength = deviceMasks.length
export const getColor = (id) => {
  // To future refactor: 
  // If you try to find index by "e.check(...)"" instead "e.id == id" on node menu doesn't get the color
  const index = deviceMasks.findIndex(e => e.id == id)
  const col = generateColorbyIndex(index, masksLength)

  return col
}


export default deviceMasks.map((e) => {
  return {
    ...e,
    capabilities: ["esphome"]
  };
});
