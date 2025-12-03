import React, { useEffect, useRef, useState } from "react";
import { AlertDialog } from 'protolib/components/AlertDialog'
import { Tinted } from 'protolib/components/Tinted'
import { Switch, useThemeName } from '@my/ui'
import { Maximize, Minimize, Upload, X, SearchCode, RefreshCcw, Download } from '@tamagui/lucide-icons'
import { Button, YStack, Text, XStack, TextArea } from "@my/ui"
import { EspWebInstall } from "./EspWebInstall"
import { EspConsole } from "./espConsole";

const DriversNote = () => {

    const Link = (props, style) => {
        return <Tinted><a
            target="_blank"
            onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none'
            }}
            {...props}
        /></Tinted>
    }

    const drivers = [
        { os: 'Windows', link: 'https://www.silabs.com/documents/public/software/CP210x_Windows_Drivers.zip' },
        { os: 'Mac', link: 'https://www.silabs.com/documents/public/software/Mac_OSX_VCP_Driver.zip' },
        { os: 'other OS', link: 'https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers?tab=downloads' }
    ]

    return <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Text fontWeight="600">{"Note: "}</Text>
        <Text >{"If you don't see your device on the menu, download the device drivers on "}</Text>
        {drivers.map((driver, index) => (
            <Link style={{ color: "var(--color8)" }} key={index} href={driver.link}>
                {`${driver.os}${index < drivers.length - 1 ? ", " : ""}`}
            </Link>
        ))}
        {"."}
    </div>
}

const DeviceModal = ({
  eraseBeforeFlash,
  setEraseBeforeFlash,
  consoleOutput,
  stage,
  onCancel,
  onSelect,
  showModal,
  modalFeedback,
  selectedDevice,
  compileSessionId,
  onSelectAction,
  logSource, // 'mqtt' | 'usb' | null | undefined
  disconnectInfo,
  compileMessages = [],
}) => {    
    const [fullscreen, setFullscreen] = useState(false);
    const [manifestUrl, setManifestUrl] = useState(null)
    const isError = modalFeedback?.details?.error
    const isLoading = ['write'].includes(stage) && !isError && !modalFeedback?.message?.includes('Please hold "Boot"')
    const themeName = useThemeName();
    const compileLogRef = useRef<HTMLTextAreaElement | null>(null);
    const stickToBottomRef = useRef(true);
    const stages = {
        'yaml': 'Uploading yaml to the project...',
        'compile': 'Compiling firmware...',
        'select-action': 'What do you want to do?',
        'upload': 'Connect your device and click select to chose the port.',
        'write': 'Writting firmware to device. Please do not unplug your device.',
        "confirm-erase": 'Do you want to erase the device before installing the firmware?',
        'idle': 'Device configured successfully.\n You can unplug your device.'
    }

    const images = {
        "light": {
            "compile": "images/device/protofitoCompiling.gif",
            "loading": "images/device/protofitoLoading.gif",
            "idle": "images/device/protofitoDancing.gif"
        },
        "dark": {
            "compile": "images/device/protofitoCompilingW.gif",
            "loading": "images/device/protofitoLoadingW.gif",
            "idle": "images/device/protofitoDancingW.gif"
        }
    }

    useEffect(() => {
        const fetchManifestUrl = async () => {
            if (stage === 'upload') {
                try {
                    const url = await selectedDevice?.getManifestUrl(compileSessionId);
                    setManifestUrl(url);
                } catch (error) {
                    console.error("Error fetching manifest URL:", error);
                }
            }
        };

        fetchManifestUrl();
    }, [stage, selectedDevice, compileSessionId]);

    useEffect(() => {
        if (!showModal) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCancel();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal, onCancel]);

    useEffect(() => {
        if (stage === 'compile' && fullscreen && compileLogRef.current && stickToBottomRef.current) {
            compileLogRef.current.scrollTop = compileLogRef.current.scrollHeight;
        }
    }, [compileMessages, stage, fullscreen]);

    useEffect(() => {
        // Reset autoscroll when re-entering compile or toggling fullscreen
        stickToBottomRef.current = true;
    }, [stage, fullscreen]);

    return <AlertDialog open={showModal} hideAccept={true}>
        <YStack
            height={stage == 'console' || fullscreen ? "80vh" : "450px"}
            width={stage == 'console' || fullscreen ? "80vw" : "500px"}
            padding={"$3"}
            gap={"$6"}
            justifyContent="space-between"
        >
            {!["console"].includes(stage) &&
                <XStack justifyContent="center" alignItems="center" >
                    <Text fontWeight="600" fontSize="xs" textAlign='center'>
                        {`[${Object.keys(stages).indexOf(stage)}/${Object.keys(stages).length}]`}
                    </Text>
                    {/* Fullscreen toggle */}
                    <Button
                        position="absolute"
                        left={0}
                        size="$2"
                        icon={fullscreen ? <Minimize size="$1" /> : <Maximize size="$1" />}
                        onPress={() => setFullscreen(prev => !prev)}
                        backgroundColor="transparent"
                        pressStyle={{ scale: 1.1 }}
                        hoverStyle={{ opacity: 0.7 }}
                        padding="$2"
                        paddingVertical="$4"
                    />
                    <Button
                        position="absolute"
                        right={0}
                        size={"$3"}
                        theme="red"
                        circular
                        icon={X}
                        onPress={() => onCancel()}
                    />
                </XStack>
            }
            {stage === 'console'
                ? <EspConsole
                    consoleOutput={consoleOutput}
                    deviceName={selectedDevice?.getId?.()}
                    onCancel={() => {
                        onCancel()
                        setFullscreen(false)
                    }}
                    showReset={logSource === 'usb'}
                    disconnectInfo={disconnectInfo}
                />
                : <YStack flex={1} maxHeight="100%" overflow="hidden">
                    {isError ? (
                        <YStack
                            flex={1}
                            gap="$3"
                            maxHeight="100%"
                            width="100%"
                            ai="center"
                            jc="center"
                            py="$3"
                            overflow="auto"
                        >
                            <YStack width="100%" flex={1} maxHeight="100%" overflow="auto" jc="center">
                                {modalFeedback?.message
                                    ? (typeof modalFeedback?.message === 'string'
                                        ? <Text color="red" textAlign="center">{modalFeedback.message}</Text>
                                        : modalFeedback.message)
                                    : <Text fontWeight={"600"} textAlign="center" color={'red'}>
                                        {stages[stage]}
                                      </Text>
                                }
                            </YStack>
                        </YStack>
                    ) : (
                        <YStack justifyContent="center" flex={1} gap={"$2"} maxHeight="100%">
                            {!(stage === 'compile' && fullscreen) && (
                                <Text fontWeight={"600"} textAlign="center" color={isError ? 'red' : ''}>
                                    {modalFeedback && ['write', 'compile', 'upload', 'yaml'].includes(stage)
                                        ? modalFeedback.message
                                        : stages[stage]
                                    }
                                </Text>
                            )}
                            {stage === 'compile' && fullscreen && (
                                <TextArea
                                    ref={compileLogRef}
                                    value={(compileMessages ?? []).join("\n")}
                                    f={1}
                                    minHeight={180}
                                    maxHeight="100%"
                                    overflow="auto"
                                    textAlign="left"
                                    resize="none"
                                    readOnly
                                    onScroll={(e) => {
                                        const target = e.currentTarget;
                                        const { scrollTop, scrollHeight, clientHeight } = target;
                                        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
                                        stickToBottomRef.current = distanceFromBottom < 20;
                                    }}
                                />
                            )}
                            {
                                !(stage === 'compile' && fullscreen) && !isError && images[themeName] && images[themeName][isLoading ? 'loading' : stage] && (
                                    <img
                                        alt="protofito dancing"
                                        style={{
                                            height: isLoading ? "200px" : "180px",
                                            width: isLoading ? "300px" : "190px",
                                            alignSelf: "center",
                                            objectFit: 'cover',
                                            paddingTop: "20px"
                                        }}
                                        src={images[themeName][isLoading ? 'loading' : stage]}
                                    />
                                )}
                        </YStack>
                    )}
                    {stage == "confirm-erase" && !isError &&
                        <XStack mt={"$8"} width={"100%"} f={1} alignItems="center" jc={"center"} gap="$2">
                            <Text>Erase device</Text>
                            <Tinted>
                                <Switch
                                    value={eraseBeforeFlash}
                                    onCheckedChange={setEraseBeforeFlash}
                                    defaultChecked={true}
                                >
                                    <Switch.Thumb backgroundColor="black" />
                                </Switch>
                            </Tinted>
                        </XStack>
                    }
                    {stage === 'upload' && !isError && <DriversNote />}
                </YStack>
            }
            {
                (stage == 'select-action' && !isError) &&
                <XStack gap="$3" flex={1} justifyContent="center">
                    <Tinted>
                        <Button icon={Upload} onPress={() => onSelectAction("confirm-erase")}>{`Install ${selectedDevice.getId()} firmware`}</Button>
                        <Button icon={SearchCode} onPress={() => onSelectAction("console")}>Watch logs</Button>
                    </Tinted>
                </XStack>
            }

            <XStack style={{ display: ["console"].includes(stage) ? "none" : "flex" }} justifyContent="center" gap={"$4"}>
                {
                    (!["write", "idle", "upload", "compile"].includes(stage) || isError) &&
                    <Button onPress={() => {
                        onCancel()
                        setFullscreen(false)
                    }}>Cancel</Button>
                }
                {
                    stage == 'upload' &&
                    <Button backgroundColor={"black"} color={"white"} onPress={() => onSelect()}>Select</Button>
                }
                {
                    stage == 'confirm-erase' &&
                    <Button backgroundColor={"black"} color={"white"} onPress={() => onSelectAction("write")}>Accept</Button>
                }
                {/* {
                        (stage == 'upload' && manifestUrl) &&
                        <EspWebInstall.ModalButton onPress={() => onCancel()} manifestUrl={manifestUrl} />
                    } */}
                {
                    stage == 'idle' &&
                    <Button backgroundColor="black" color={"white"} onPress={() => onCancel()}>Done !</Button>
                }
            </XStack>
        </YStack>
    </AlertDialog >
}

export default DeviceModal
