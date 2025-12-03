import React, { useEffect, useState } from "react";
import { XStack, YStack, Text, Button, Input, Switch, useToastController, TextArea } from '@my/ui';
import { AlertDialog } from 'protolib/components/AlertDialog';
import { Tinted } from 'protolib/components/Tinted';
import { Plus, Trash2, Save, X, ChevronDown } from "@tamagui/lucide-icons";
import { API } from 'protobase';

const safeStringify = (value: any) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '';
    }
};

const deepClone = <T,>(value: T): T => {
    try {
        return JSON.parse(JSON.stringify(value ?? []));
    } catch {
        return value;
    }
};

const JsonField = ({ label, value, onChange, placeholder }: { label: string, value: any, onChange: (v: any) => void, placeholder?: string }) => {
    const [text, setText] = useState<string>(safeStringify(value));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setText(safeStringify(value));
    }, [value]);

    const handleChange = (val: any) => {
        const next = typeof val === 'string' ? val : val?.target?.value ?? '';
        setText(next);
    };

    const commit = () => {
        if (text.trim() === '') {
            onChange(undefined);
            setError(null);
            return;
        }
        try {
            const parsed = JSON.parse(text);
            onChange(parsed);
            setError(null);
        } catch (err: any) {
            setError(err?.message ?? 'Invalid JSON');
        }
    };

    return (
        <YStack gap="$1" width="100%">
            <Text size="$2" color="$color10">{label}</Text>
            <TextArea
                value={text}
                onChange={handleChange}
                onChangeText={handleChange}
                onBlur={commit}
                minHeight={100}
                fontFamily="monospace"
                placeholder={placeholder}
            />
            {error ? <Text size="$2" color="$red10">{error}</Text> : null}
        </YStack>
    );
};

const CollapsibleSection = ({ title, children, defaultOpen = true }: { title: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <YStack gap="$2" width="100%">
            <Button
                unstyled
                padding="$2"
                borderRadius="$3"
                onPress={() => setOpen(o => !o)}
                backgroundColor="$color2"
                hoverStyle={{ backgroundColor: "$color3" }}
                justifyContent="space-between"
                alignItems="center"
                width="100%"
            >
                <Text fow="700">{title}</Text>
                <ChevronDown
                    size={16}
                    style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] as any }}
                />
            </Button>
            {open ? <YStack gap="$2">{children}</YStack> : null}
        </YStack>
    );
};

type SubsystemEditorProps = {
    open: boolean;
    onClose: () => void;
    deviceName?: string;
    subsystems?: any[];
    onSaved?: (next: any[]) => void;
};

export const SubsystemsEditor = ({ open, onClose, deviceName, subsystems, onSaved }: SubsystemEditorProps) => {
    const toast = useToastController();
    const [draftSubsystems, setDraftSubsystems] = useState<any[]>(deepClone(subsystems ?? []));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDraftSubsystems(deepClone(subsystems ?? []));
            setError(null);
        }
    }, [open, subsystems]);

    const updateSubsystemField = (index: number, field: string, value: any) => {
        setDraftSubsystems((prev) => {
            const next = [...(prev ?? [])];
            const current = next[index] ?? { monitors: [], actions: [] };
            next[index] = { ...current, [field]: value };
            return next;
        });
    };

    const updateMonitorField = (subsystemIndex: number, monitorIndex: number, field: string, value: any) => {
        setDraftSubsystems((prev) => {
            const next = [...(prev ?? [])];
            const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
            const monitors = [...(currentSubsystem.monitors ?? [])];
            monitors[monitorIndex] = { ...(monitors[monitorIndex] ?? {}), [field]: value };
            next[subsystemIndex] = { ...currentSubsystem, monitors };
            return next;
        });
    };

    const updateActionField = (subsystemIndex: number, actionIndex: number, field: string, value: any) => {
        setDraftSubsystems((prev) => {
            const next = [...(prev ?? [])];
            const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
            const actions = [...(currentSubsystem.actions ?? [])];
            actions[actionIndex] = { ...(actions[actionIndex] ?? {}), [field]: value };
            next[subsystemIndex] = { ...currentSubsystem, actions };
            return next;
        });
    };

    const addSubsystem = () => setDraftSubsystems((prev) => [...(prev ?? []), { name: `subsystem_${(prev?.length ?? 0) + 1}`, type: '', monitors: [], actions: [] }]);
    const removeSubsystem = (index: number) => setDraftSubsystems((prev) => (prev ?? []).filter((_, i) => i !== index));

    const addMonitor = (subsystemIndex: number) => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const monitors = [...(currentSubsystem.monitors ?? []), { name: '', label: '', endpoint: '', units: '', connectionType: 'mqtt' }];
        next[subsystemIndex] = { ...currentSubsystem, monitors };
        return next;
    });
    const removeMonitor = (subsystemIndex: number, monitorIndex: number) => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const monitors = (currentSubsystem.monitors ?? []).filter((_, i) => i !== monitorIndex);
        next[subsystemIndex] = { ...currentSubsystem, monitors };
        return next;
    });

    const addAction = (subsystemIndex: number) => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const actions = [...(currentSubsystem.actions ?? []), { name: '', label: '', endpoint: '', connectionType: 'mqtt', payload: {} }];
        next[subsystemIndex] = { ...currentSubsystem, actions };
        return next;
    });
    const removeAction = (subsystemIndex: number, actionIndex: number) => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const actions = (currentSubsystem.actions ?? []).filter((_, i) => i !== actionIndex);
        next[subsystemIndex] = { ...currentSubsystem, actions };
        return next;
    });

    const onSave = async () => {
        if (!deviceName) {
            setError('No device name provided');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const current = await API.get(`/api/core/v1/devices/${deviceName}`);
            const currentData = current?.data ?? current;
            if (!currentData || current?.isError) {
                throw new Error(current?.error ?? 'Unable to load device');
            }
            const payload = { ...currentData, subsystem: draftSubsystems };

            let saved = false;
            try {
                const apiResponse: any = (API as any)?.post
                    ? await (API as any).post(`/api/core/v1/devices/${encodeURIComponent(deviceName)}`, payload)
                    : undefined;
                if (apiResponse && !apiResponse?.isError) {
                    saved = true;
                } else if (apiResponse?.isError) {
                    throw new Error(apiResponse?.error ?? 'Failed to save subsystems');
                }
            } catch (apiErr) {
                console.warn('Subsystems save via API.post failed, retrying with fetch', apiErr);
            }

            if (!saved) {
                const url = `/api/core/v1/devices/${encodeURIComponent(deviceName)}`;
                const attemptSave = async (method: 'PUT' | 'POST') => {
                    const response = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        credentials: 'include'
                    });
                    const text = await response.text().catch(() => '');
                    let json: any = undefined;
                    try { json = text ? JSON.parse(text) : undefined; } catch { }
                    if (!response.ok || json?.error || json?.isError) {
                        const msg = json?.error ?? (text || `Failed to save subsystems (${response.status})`);
                        throw new Error(msg);
                    }
                };

                try {
                    await attemptSave('PUT');
                } catch (err: any) {
                    if (err?.message?.includes('(404)') || err?.message?.includes('(405)')) {
                        await attemptSave('POST');
                    } else {
                        throw err;
                    }
                }
            }

            toast.show('Device subsystems updated', { duration: 2000 });
            onSaved?.(draftSubsystems);
            onClose();
        } catch (err: any) {
            const message = err?.message ?? 'Failed to save subsystems';
            setError(message);
            toast.show(message, { duration: 3000 });
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <AlertDialog open={open} setOpen={(v) => { if (!v) onClose(); }} hideAccept={true} width={"95vw"} height={"85vh"} p="$0">
            <YStack padding="$4" gap="$3" height="100%" overflow="scroll" width="100%" maxWidth="100%" alignSelf="stretch">
                <XStack justifyContent="space-between" alignItems="center">
                    <Text fow="700">Edit subsystems</Text>
                    <XStack gap="$2">
                        <Button size="$2" icon={X} disabled={saving} onPress={() => onClose()}>
                            Close
                        </Button>
                        <Button size="$2" icon={Save} disabled={saving} onPress={onSave}>
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </XStack>
                </XStack>
                {error ? <Text color="$red10" size="$2">{error}</Text> : null}

                <YStack gap="$3" width="100%" maxWidth="100%">
                    {draftSubsystems?.map((subsystem, subsystemIndex) => (
                        <Tinted key={subsystem?.name ?? subsystemIndex} width="100%">
                            <YStack gap="$3" padding="$3" width="100%">
                                <XStack justifyContent="space-between" alignItems="center">
                                    <Text fow="600">{subsystem?.name || `Subsystem ${subsystemIndex + 1}`}</Text>
                                    <Button
                                        size="$2"
                                        icon={Trash2}
                                        onPress={() => removeSubsystem(subsystemIndex)}
                                        theme="red"
                                        disabled={saving}
                                    >
                                        Remove subsystem
                                    </Button>
                                </XStack>
                                <CollapsibleSection title="Subsystem info">
                                    <XStack gap="$3" flexWrap="wrap">
                                        <Input
                                            placeholder="Name"
                                            value={subsystem?.name ?? ''}
                                            onChange={(e) => updateSubsystemField(subsystemIndex, 'name', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Type"
                                            value={subsystem?.type ?? ''}
                                            onChange={(e) => updateSubsystemField(subsystemIndex, 'type', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Label"
                                            value={subsystem?.label ?? ''}
                                            onChange={(e) => updateSubsystemField(subsystemIndex, 'label', e.target.value)}
                                        />
                                    </XStack>

                                    <JsonField
                                        label="Config (JSON)"
                                        value={subsystem?.config ?? {}}
                                        onChange={(v) => updateSubsystemField(subsystemIndex, 'config', v ?? {})}
                                        placeholder='{"example":true}'
                                    />
                                </CollapsibleSection>

                                <CollapsibleSection title="Monitors">
                                    <YStack gap="$2" width="100%">
                                        <XStack justifyContent="space-between" alignItems="center">
                                            <Text fow="600">Monitors</Text>
                                            <Button size="$2" icon={Plus} onPress={() => addMonitor(subsystemIndex)} disabled={saving}>Add monitor</Button>
                                        </XStack>
                                        {subsystem?.monitors?.map((monitor, monitorIndex) => (
                                            <Tinted key={`${monitor?.name ?? monitorIndex}-${subsystemIndex}`} width="100%">
                                                <CollapsibleSection title={monitor?.label || monitor?.name || `Monitor ${monitorIndex + 1}`}>
                                                    <YStack gap="$2" padding="$2" width="100%">
                                                        <XStack justifyContent="space-between" alignItems="center">
                                                            <Text fow="600">{monitor?.label || monitor?.name || `Monitor ${monitorIndex + 1}`}</Text>
                                                            <Button
                                                                size="$2"
                                                                icon={Trash2}
                                                                theme="red"
                                                                onPress={() => removeMonitor(subsystemIndex, monitorIndex)}
                                                                disabled={saving}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </XStack>
                                                        <XStack gap="$2" flexWrap="wrap">
                                                            <Input
                                                                placeholder="Name"
                                                                value={monitor?.name ?? ''}
                                                                onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'name', e.target.value)}
                                                            />
                                                            <Input
                                                                placeholder="Label"
                                                                value={monitor?.label ?? ''}
                                                                onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'label', e.target.value)}
                                                            />
                                                            <Input
                                                                placeholder="Endpoint"
                                                                value={monitor?.endpoint ?? ''}
                                                                onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'endpoint', e.target.value)}
                                                                flex={1}
                                                            />
                                                            <Input
                                                                placeholder="Units"
                                                                value={monitor?.units ?? ''}
                                                                onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'units', e.target.value)}
                                                            />
                                                            <XStack alignItems="center" gap="$2">
                                                                <Text size="$2">Ephemeral</Text>
                                                                <Switch
                                                                    checked={!!monitor?.ephemeral}
                                                                    onCheckedChange={(checked) => updateMonitorField(subsystemIndex, monitorIndex, 'ephemeral', !!checked)}
                                                                >
                                                                    <Switch.Thumb />
                                                                </Switch>
                                                            </XStack>
                                                        </XStack>
                                                        <JsonField
                                                            label="Props (JSON)"
                                                            value={monitor?.props ?? {}}
                                                            onChange={(v) => updateMonitorField(subsystemIndex, monitorIndex, 'props', v ?? {})}
                                                            placeholder='{"color":"#fff"}'
                                                        />
                                                    </YStack>
                                                </CollapsibleSection>
                                            </Tinted>
                                        ))}
                                    </YStack>
                                </CollapsibleSection>

                                <CollapsibleSection title="Actions">
                                    <YStack gap="$2" width="100%">
                                        <XStack justifyContent="space-between" alignItems="center">
                                            <Text fow="600">Actions</Text>
                                            <Button size="$2" icon={Plus} onPress={() => addAction(subsystemIndex)} disabled={saving}>Add action</Button>
                                        </XStack>
                                        {subsystem?.actions?.map((action, actionIndex) => (
                                            <Tinted key={`${action?.name ?? actionIndex}-${subsystemIndex}`} width="100%">
                                                <CollapsibleSection title={action?.label || action?.name || `Action ${actionIndex + 1}`}>
                                                    <YStack gap="$2" padding="$2" width="100%">
                                                        <XStack justifyContent="space-between" alignItems="center">
                                                            <Text fow="600">{action?.label || action?.name || `Action ${actionIndex + 1}`}</Text>
                                                            <Button
                                                                size="$2"
                                                                icon={Trash2}
                                                                theme="red"
                                                                onPress={() => removeAction(subsystemIndex, actionIndex)}
                                                                disabled={saving}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </XStack>
                                                        <XStack gap="$2" flexWrap="wrap">
                                                            <Input
                                                                placeholder="Name"
                                                                value={action?.name ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'name', e.target.value)}
                                                            />
                                                            <Input
                                                                placeholder="Label"
                                                                value={action?.label ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'label', e.target.value)}
                                                            />
                                                            <Input
                                                                placeholder="Description"
                                                                value={action?.description ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'description', e.target.value)}
                                                                flex={1}
                                                            />
                                                            <Input
                                                                placeholder="Endpoint"
                                                                value={action?.endpoint ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'endpoint', e.target.value)}
                                                                flex={1}
                                                            />
                                                            <Input
                                                                placeholder="Connection type"
                                                                value={action?.connectionType ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'connectionType', e.target.value)}
                                                            />
                                                            <Input
                                                                placeholder="Mode"
                                                                value={action?.mode ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'mode', e.target.value)}
                                                            />
                                                            <Input
                                                                placeholder="Reply timeout (ms)"
                                                                value={action?.replyTimeoutMs ?? ''}
                                                                onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'replyTimeoutMs', e.target.value)}
                                                            />
                                                        </XStack>
                                                        <JsonField
                                                            label="Payload (JSON)"
                                                            value={action?.payload ?? {}}
                                                            onChange={(v) => updateActionField(subsystemIndex, actionIndex, 'payload', v ?? {})}
                                                            placeholder='{"type":"str","value":"ON"}'
                                                        />
                                                        <JsonField
                                                            label="Props (JSON)"
                                                            value={action?.props ?? {}}
                                                            onChange={(v) => updateActionField(subsystemIndex, actionIndex, 'props', v ?? {})}
                                                            placeholder='{"theme":"green","color":"$green10"}'
                                                        />
                                                        <JsonField
                                                            label="Card props (JSON)"
                                                            value={action?.cardProps ?? {}}
                                                            onChange={(v) => updateActionField(subsystemIndex, actionIndex, 'cardProps', v ?? {})}
                                                            placeholder='{"icon":"power","color":"$green10"}'
                                                        />
                                                    </YStack>
                                                </CollapsibleSection>
                                            </Tinted>
                                        ))}
                                    </YStack>
                                </CollapsibleSection>
                            </YStack>
                        </Tinted>
                    ))}
                    <Button icon={Plus} onPress={addSubsystem} disabled={saving}>Add subsystem</Button>
                </YStack>
            </YStack>
        </AlertDialog>
    );
};

