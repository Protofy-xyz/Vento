import { useEffect, useMemo, useRef, useState } from "react";
import { Button, YStack, Paragraph, XStack } from '@my/ui';
import { Camera, Hand, TimerReset, Video, VideoOff } from '@tamagui/lucide-icons';
import { Tinted } from "../Tinted";

type CameraCardProps = {
    params?: {
        fps?: { defaultValue?: number };
        mode?: { defaultValue?: 'auto' | 'manual' };
    };
    onPicture: (base64: string) => void;
    startLabel?: string;
    stopLabel?: string;
};

export const CameraCard = ({ params, onPicture, startLabel = "Open Camera", stopLabel = "" }: CameraCardProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [isOn, setIsOn] = useState(false);
    const [busy, setBusy] = useState(false);
    const [mode, setMode] = useState<'auto' | 'manual'>(params?.mode?.defaultValue ?? 'auto');

    const fps = params?.fps?.defaultValue || 1;

    function normalizeMediaError(e: unknown) {
        const any = e as any;
        const name = any?.name || 'MediaError';
        const message = any?.message || '';
        if (name === 'NotAllowedError') return 'Denied permission to use camera.';
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera found on this device.';
        if (name === 'NotReadableError' || name === 'TrackStartError') return 'Unable to access camera (is it already in use?).';
        if (name === 'OverconstrainedError' && any?.constraint) return `Overconstrained Error: ${any.constraint}.`;
        return message ? `${name}: ${message}` : name;
    }

    const startCamera = async () => {
        try {
            setBusy(true);
            setError(null);

            if ((window as any).webcam?.arm) {
                await (window as any).webcam.arm(8000);
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => { });
            }
            setIsOn(true);
        } catch (err) {
            setError("Unable to access camera: " + normalizeMediaError(err));
            setIsOn(false);
        } finally {
            setBusy(false);
        }
    };

    const stopCamera = () => {
        try {
            const stream = videoRef.current?.srcObject as MediaStream | null;
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        } catch { }
        setIsOn(false);
    };

    const toggleCamera = async () => {
        if (isOn) stopCamera();
        else await startCamera();
    };

    const captureImage = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, width, height);
        const base64Image = canvas.toDataURL("image/jpeg");
        onPicture(base64Image);
    };

    useEffect(() => {
        if (mode !== 'auto' || !isOn) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => captureImage(), Math.max(1, Math.floor(1000 / fps)));
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [mode, fps, isOn]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            stopCamera();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return useMemo(() => (
        <YStack ai="center" space="$4" height="100%">

            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "99%", background: "#000", borderRadius: 8 }}
            />

            <canvas ref={canvasRef} style={{ display: "none" }} />

            <YStack pos="absolute" bottom="$1.5" w="100%" p="$3">
                {error && (
                    <Paragraph color="red" fontWeight="600">
                        {error}
                    </Paragraph>
                )}
                <XStack f={1} gap="$2" w="100%">
                    <Button
                        icon={isOn ? VideoOff : Video}
                        onPress={toggleCamera}
                        size="$4"
                        theme={isOn ? "red" : "active"}
                        scaleIcon={1.2}
                        f={isOn ? undefined : 1}
                        disabled={busy}
                        className="no-drag"
                    >
                        {isOn ? stopLabel : startLabel}
                    </Button>
                    {isOn && <Tinted tint="green">
                        <Button
                            icon={mode === 'auto' ? Hand : TimerReset}
                            onPress={() => setMode(mode === 'auto' ? 'manual' : 'auto')}
                            size="$4"
                            scaleIcon={1.2}
                            f={1}
                            disabled={busy}
                            theme="active"
                            className="no-drag"
                        >
                            {mode === 'auto' ? 'Manual' : 'Auto'}
                        </Button>
                    </Tinted>
                    }

                    {mode === 'manual' && isOn && (
                        <Button
                            icon={Camera}
                            onPress={captureImage}
                            theme="active"
                            size="$4"
                            className="no-drag"
                            f={1}
                        >
                            Take Picture
                        </Button>
                    )}
                </XStack>
            </YStack>
        </YStack>
    ), [mode, fps, error, isOn, busy]);
};
