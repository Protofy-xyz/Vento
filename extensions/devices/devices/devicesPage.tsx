import React, { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import { BookOpen, Tag, Wrench, CheckCircle } from '@tamagui/lucide-icons';
import { DevicesModel } from './devicesSchemas';
import { API } from 'protobase';
import { DataTable2 } from 'protolib/components/DataTable2';
import { DataView } from 'protolib/components/DataView';
import { ButtonSimple } from 'protolib/components/ButtonSimple';
import { AdminPage } from 'protolib/components/AdminPage';
import { usePendingEffect } from 'protolib/lib/usePendingEffect';
import { CardBody } from 'protolib/components/CardBody';
import { ItemMenu } from 'protolib/components/ItemMenu';
import { Tinted } from 'protolib/components/Tinted';
import * as deviceFunctions from 'protodevice/src/device'
import { Subsystems } from 'protodevice/src/Subsystem'
import { Paragraph, XStack, YStack, Text, Button } from '@my/ui';
import { getPendingResult } from "protobase";
import { Pencil, UploadCloud, Navigation, Bug } from '@tamagui/lucide-icons';
import { usePageParams } from 'protolib/next';
import { downloadDeviceFirmwareEndpoint, downloadDeviceElfEndpoint  } from "@extensions/esphome/utils";
import { SSR } from 'protolib/lib/SSR'
import { withSession } from 'protolib/lib/Session'
import { SelectList } from 'protolib/components/SelectList';
import { useEsphomeDeviceActions } from '@extensions/esphome/hooks/useEsphomeDeviceActions';
import { AlertDialog } from 'protolib/components/AlertDialog';

const DevicesIcons = { name: Tag, deviceDefinition: BookOpen }

const sourceUrl = '/api/core/v1/devices'
const definitionsSourceUrl = '/api/core/v1/deviceDefinitions?all=1'

export default {
  component: ({ pageState, initialItems, itemData, pageSession, extraData }: any) => {
    const { replace, query } = usePageParams(pageState)
    if (typeof window !== 'undefined') {
      Object.keys(deviceFunctions).forEach(k => (window as any)[k] = deviceFunctions[k])
    }
    const [deviceDefinitions, setDeviceDefinitions] = useState(extraData?.deviceDefinitions ?? getPendingResult('pending'))
    usePendingEffect((s) => { API.get({ url: definitionsSourceUrl }, s) }, setDeviceDefinitions, extraData?.deviceDefinitions)
    const router = useRouter();
    const { flashDevice, uploadConfigFile, viewLogs, ui: deviceActionsUi } = useEsphomeDeviceActions();

    // Handle "created" parameter from network wizard
    const [createdDevice, setCreatedDevice] = useState<any>(null)
    const [showCreatedDialog, setShowCreatedDialog] = useState(false)

    useEffect(() => {
      const created = query?.created
      if (created && typeof created === 'string') {
        // Fetch the created device
        API.get(`${sourceUrl}/${created}`).then((result) => {
          if (!result.isError && result.data) {
            setCreatedDevice(DevicesModel.load(result.data))
            setShowCreatedDialog(true)
          }
        })
      }
    }, [query?.created])

    const handleCloseCreatedDialog = () => {
      setShowCreatedDialog(false)
      setCreatedDevice(null)
      // Remove the created parameter from URL
      replace('created', undefined)
    }

    const extraMenuActions = [
      {
        text: "Upload definition file",
        icon: UploadCloud,
        action: (element) => { flashDevice(element) },
        isVisible: (element) => element.data.deviceDefinition
      },
      {
        text: "Edit config file",
        icon: Pencil,
        action: (element) => { replace('editFile', element.getConfigFile()) },
        isVisible: (element) => element.getConfigFile()
      },
      {
        text: "Upload config file",
        icon: UploadCloud,
        action: async (element) => {
          await uploadConfigFile(element)
        },
        isVisible: (element) => element.getConfigFile()
      },
      {
        text: "View logs",
        icon: Bug,
        action: async (element) => {
          await viewLogs(element)
        },
        isVisible: (element) => element.getLogs()
      },
      {
        text: "Download firmware binary",
        icon: Wrench,
        action: async (element) => {
          try {
            if (!element.data.data.lastCompile.success) return;
            const response = await fetch(downloadDeviceFirmwareEndpoint(element.data.name, element.data.data.lastCompile.sessionId));
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${element.data.name}.bin`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Error downloading firmware binary:', err);
          }
        },
        isVisible: (element) => element?.data?.data?.lastCompile?.success
      },
      {
        text: "Download firmware ELF",
        icon: Wrench,
        action: async (element) => {
          try {
            if (!element.data.data.lastCompile.success) return;
            const response = await fetch(downloadDeviceElfEndpoint(element.data.name, element.data.data.lastCompile.sessionId));
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${element.data.name}.elf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Error downloading firmware ELF:', err);
          }
        },
        isVisible: (element) => element?.data?.data?.lastCompile?.success
      }
    ]

    return (<AdminPage title="Devices" pageSession={pageSession}>
      {deviceActionsUi}

      {/* Device Created Dialog */}
      <AlertDialog
        open={showCreatedDialog}
        setOpen={setShowCreatedDialog}
        title="Device Created"
        description=""
        hideAccept={true}
        onOpenChange={(open) => {
          if (!open) handleCloseCreatedDialog()
        }}
      >
        <YStack padding="$4" alignItems="center" gap="$4">
          <Tinted>
            <CheckCircle size={48} color="var(--color9)" />
          </Tinted>
          <Text fontSize="$6" fontWeight="600" textAlign="center">
            Device "{createdDevice?.data?.name}" has been created successfully!
          </Text>
          {createdDevice?.data?.deviceDefinition ? (
            <Text fontSize="$4" color="$gray11" textAlign="center">
              Template: {createdDevice.data.deviceDefinition}
            </Text>
          ) : (
            <Text fontSize="$4" color="$gray11" textAlign="center">
              No template selected. You can configure it manually.
            </Text>
          )}
          <XStack gap="$4" marginTop="$4">
            <Button onPress={handleCloseCreatedDialog}>
              Close
            </Button>
            {createdDevice?.data?.deviceDefinition && (
              <Tinted>
                <Button
                  icon={UploadCloud}
                  onPress={() => {
                    handleCloseCreatedDialog()
                    flashDevice(createdDevice)
                  }}
                >
                  Upload Definition
                </Button>
              </Tinted>
            )}
            {!createdDevice?.data?.deviceDefinition && createdDevice?.getConfigFile() && (
              <Tinted>
                <Button
                  icon={UploadCloud}
                  onPress={async () => {
                    handleCloseCreatedDialog()
                    await uploadConfigFile(createdDevice)
                  }}
                >
                  Upload Config
                </Button>
              </Tinted>
            )}
          </XStack>
        </YStack>
      </AlertDialog>

      <DataView
        entityName="devices"
        title=""
        toolBarContent={
          <XStack gap="$6">
            <XStack cursor="pointer" hoverStyle={{ opacity: 0.8 }} onPress={() => router.push('/devices')}>
              <Paragraph>
                <Text fontSize="$9" fontWeight="600" color="$color11">
                  Devices
                </Text>
              </Paragraph>
            </XStack>
            <XStack cursor="pointer" hoverStyle={{ opacity: 0.8 }} onPress={() => router.push('/deviceDefinitions')}>
              <Paragraph>
                <Text fontSize="$9" fontWeight="600" color="$color8">
                  Templates
                </Text>
              </Paragraph>
            </XStack>
          </XStack>
        }
        itemData={itemData}
        sourceUrl={sourceUrl}
        initialItems={initialItems}
        name="device"
        columns={DataTable2.columns(
          DataTable2.column("name", row => row.name, "name"),
          DataTable2.column("platform", row => row.platform, "platform"),
          DataTable2.column("device definition", row => row.deviceDefinition, "deviceDefinition"),
          DataTable2.column("config", row => row.config, false, (row) => {
            const device = DevicesModel.load(row);
            const hasDefinition = Boolean(device.data.deviceDefinition);

            const buttonLabel = hasDefinition ? "Upload definition" : "Upload config";

            return device.data.platform == "esphome" ? (
              <ButtonSimple
                onPress={async () => {
                  if (!hasDefinition) {
                    await uploadConfigFile(device);
                    return;
                  }
                  flashDevice(device);
                }}
              >
                {buttonLabel}
              </ButtonSimple>
            ):(<></>)
          })
        )}
        customFields={{
          deviceDefinition: {
            component: (path, data, setData, mode) => {
              const definitions = deviceDefinitions.isLoaded ? deviceDefinitions.data.items.map(definition => definition.name) : []
              return <SelectList
                //@ts-ignore
                f={1}
                title={definitions.length
                  ? 'Definitions'
                  : <YStack f={1} ai="center" p={"$2"} py={"$6"} gap="$4">
                    <Tinted>
                      <Text fos={14} fow={"600"}>You don't have any definitions yet</Text>
                      <Button icon={Navigation} onPress={() => router.push('/deviceDefinitions')} >
                        Go to definitions
                      </Button>
                    </Tinted>
                  </YStack>
                }
                placeholder={'Select a definition'}
                elements={definitions}
                value={data}
                setValue={(v) => setData(v)}
              />
            }
          }
        }}
        model={DevicesModel}
        pageState={pageState}
        icons={DevicesIcons}
        dataTableGridProps={{
          disableItemSelection: true,
          itemMinWidth: 500,
          onSelectItem: (item) => { },
          getBody: (data) => <CardBody title={data.name} separator={false}>
            <XStack right={20} top={20} position={"absolute"}>
              <ItemMenu type="item" sourceUrl={sourceUrl} onDelete={async (sourceUrl, deviceId?: string) => {
                await API.get(`${sourceUrl}/${deviceId}/delete`)
              }} deleteable={() => true} element={DevicesModel.load(data)} extraMenuActions={extraMenuActions} />
            </XStack>
            <YStack f={1}>
              {data?.subsystem
                ? <Subsystems subsystems={data.subsystem} deviceName={data.name} />
                : (
                  <>
                    <Paragraph mt="20px" ml="20px" size={20}>{'You need to upload the device'}</Paragraph>
                    <ButtonSimple mt="20px" ml="20px" width={100} onPress={() => { flashDevice(DevicesModel.load(data)); }}>Upload</ButtonSimple>
                  </>
                )
              }
            </YStack>
          </CardBody>
        }}
        dataTableListProps={{
          disableRowIcon: true,
          onEditItem: (item) => { 
            if(item.data.platform == "esphome") {
            replace('editFile', item.getConfigFile()) 
          }else{
            return null
          }
        }}}
        extraMenuActions={extraMenuActions}
      />
    </AdminPage>)
  },
  getServerSideProps: SSR(async (context) => withSession(context, ['admin']))
}
