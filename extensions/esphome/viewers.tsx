import React, { useEffect, useMemo, useState } from 'react';
import { FlowsViewer } from '@extensions/files/intents'
import { loadEsphomeHelpers } from './utils'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import ESPHomeDiagram from './network/ESPHomeDiagram';
import { Bug, Cpu, UploadCloud } from '@tamagui/lucide-icons';
import { useEsphomeValidationWarning } from './hooks/useEsphomeValidationWarning';
import { useEsphomeDeviceActions } from '@extensions/esphome/hooks/useEsphomeDeviceActions';
import { DevicesModel } from '@extensions/devices/devices/devicesSchemas';
import { API } from 'protobase';
import { Paragraph, XStack } from '@my/ui';
import { IconContainer } from 'protolib/components/IconContainer';

const DIAGRAM_VISIBLE = true

const getDeviceNameFromPath = (path?: string) => {
    if (!path) return '';
    const normalized = path.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    const devicesIdx = segments.lastIndexOf('devices');
    if (devicesIdx !== -1 && segments[devicesIdx + 1]) {
        return segments[devicesIdx + 1];
    }

    const lastSegment = segments[segments.length - 1] ?? '';
    const baseName = lastSegment.split('.')[0];
    return baseName;
};

export default ({ ...props }: any) => {
    const validationWarning = useEsphomeValidationWarning();
    const { uploadConfigFile, viewLogs, ui: deviceActionsUi } = useEsphomeDeviceActions();
    const deviceName = useMemo(() => getDeviceNameFromPath(props?.path), [props?.path]);
    const [deviceModel, setDeviceModel] = useState<DevicesModel | null>(null);
    const [deviceLoadError, setDeviceLoadError] = useState<string | null>(null);
    const [loadingDevice, setLoadingDevice] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (!deviceName) {
            setDeviceModel(null);
            setDeviceLoadError(null);
            return;
        }

        const fetchDevice = async () => {
            setLoadingDevice(true);
            setDeviceLoadError(null);
            try {
                const response = await API.get(`/api/core/v1/devices/${deviceName}`);
                if (cancelled) return;
                if ((response as any)?.isError || !response?.data) {
                    setDeviceModel(null);
                    setDeviceLoadError('Device not found or unavailable.');
                    return;
                }
                setDeviceModel(DevicesModel.load(response.data));
            } catch (err) {
                if (!cancelled) {
                    setDeviceModel(null);
                    setDeviceLoadError('Error loading device data.');
                }
            } finally {
                if (!cancelled) setLoadingDevice(false);
            }
        };

        fetchDevice();
        return () => {
            cancelled = true;
        };
    }, [deviceName]);

    const actionDisabled = !deviceModel || loadingDevice;
    const actionButtons = (
        <XStack gap="$1" ai="center">
            {deviceLoadError && (
                <Paragraph size="$2" color="$red10">
                    {deviceLoadError}
                </Paragraph>
            )}
            <IconContainer
                disabled={actionDisabled}
                onPress={() => { if (deviceModel) viewLogs(deviceModel); }}
                opacity={actionDisabled ? 0.35 : 1}
                title="View logs"
            >
                <Bug color="var(--color)" size={"$1"} />
            </IconContainer>
            <IconContainer
                disabled={actionDisabled}
                onPress={() => { if (deviceModel) uploadConfigFile(deviceModel); }}
                opacity={actionDisabled ? 0.35 : 1}
                title="Upload config"
            >
                <UploadCloud color="var(--color)" size={"$1"} />
            </IconContainer>
        </XStack>
    );

    return (
        <>
            {deviceActionsUi}
            <FlowsViewer
                {...props}
                saveButtonWarning={validationWarning}
                codeviewProps={{
                    rulesProps: {
                        "title": "ESPHome YAML",
                    },
                    flowsProps: {
                        mode: "json",
                        onBeforePrepare: (sourceCode, mode) => {
                            try {
                                const obj = yamlParse(sourceCode);
                                const json = JSON.stringify(obj, null, 2);
                                return json
                            } catch (e) {
                                console.error('Error parsing YAML, using raw source:', e);
                                return sourceCode
                            }
                        },
                        onBeforeSave: (rawContent, mode) => {
                            try {
                                const obj = JSON.parse(rawContent);
                                // Disable folding to avoid multi-line block scalars such as ">-"
                                return yamlStringify(obj, { lineWidth: 0 });
                            } catch (e) {
                                console.error('Error converting JSON to YAML, keeping JSON:', e);
                                return rawContent;
                            }
                        }
                    },
                    ...DIAGRAM_VISIBLE ? {
                        extraPanels: [
                            {
                                id: "esphome",
                                content: (data) => {
                                    return <ESPHomeDiagram yaml={data.code} setCode={data.setCode} />
                                }, title: "Esphome Helpers", icon: () => <Cpu color="var(--color)" size={"$1"}/>
                            },
                        ]
                    } : {},
                    rightIcons: actionButtons
                }}
                monacoProps={{
                    onLoad: loadEsphomeHelpers,
                    defaultLanguage: "esphome",
                }}
            />
        </>
    )
}
