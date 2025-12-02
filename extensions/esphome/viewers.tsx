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
import { useFileFromAPI } from 'protolib/lib/useFileFromAPI';

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
    const [fileContent] = useFileFromAPI(props?.path);
    const normalizedPath = useMemo(
        () => (props?.path ? props.path.replace(/\\/g, '/') : ''),
        [props?.path]
    );
    const isDefinitionPath = useMemo(
        () => normalizedPath.includes('/deviceDefinitions/') || normalizedPath.split('/').includes('deviceDefinitions'),
        [normalizedPath]
    );
    const yamlDeviceName = useMemo(() => {
        if (!fileContent?.isLoaded || !fileContent.data) return '';
        try {
            const parsed = yamlParse(fileContent.data);
            const name = parsed?.esphome?.name || parsed?.name;
            return typeof name === 'string' ? name : '';
        } catch (err) {
            console.error('Error parsing YAML to get device name', err);
            return '';
        }
    }, [fileContent?.isLoaded, fileContent?.data]);
    const deviceName = useMemo(
        () => yamlDeviceName || getDeviceNameFromPath(props?.path),
        [yamlDeviceName, props?.path]
    );
    const [deviceModel, setDeviceModel] = useState<DevicesModel | null>(null);
    const [deviceLoadError, setDeviceLoadError] = useState<string | null>(null);
    const [loadingDevice, setLoadingDevice] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (isDefinitionPath) {
            setDeviceModel(null);
            setDeviceLoadError(null);
            return;
        }
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
                    setDeviceLoadError(`Device ${deviceName} not found or unavailable.`);
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
    }, [deviceName, isDefinitionPath]);

    const actionDisabled = !deviceModel || loadingDevice;
    const actionButtons = isDefinitionPath
        ? null
        : actionDisabled
        ? (
            deviceLoadError ? (
                <Paragraph size="$2" color="$red10">
                    {deviceLoadError}
                </Paragraph>
            ) : null
        )
        : (
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
