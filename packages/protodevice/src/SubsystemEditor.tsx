import React, { useEffect, useState, useTransition } from "react";
import { XStack, YStack, Text, Button, Input, Switch, useToastController, TextArea, Select } from '@my/ui';
import { AlertDialog } from 'protolib/components/AlertDialog';
import { Tinted } from 'protolib/components/Tinted';
import { Plus, Trash2, Save, X, ChevronDown, Check, Maximize2 } from "@tamagui/lucide-icons";
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
    const [expanded, setExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setText(safeStringify(value));
        }
    }, [value, isEditing]);

    const handleChange = (val: any) => {
        const next = typeof val === 'string' ? val : val?.target?.value ?? '';
        setText(next);
        if (next.trim() === '') {
            setError(null);
            return;
        }
        try {
            JSON.parse(next);
            setError(null);
        } catch (err: any) {
            setError(err?.message ?? 'Invalid JSON');
        }
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
            <XStack justifyContent="space-between" alignItems="center">
                <Text size="$2" color="$color10">{label}</Text>
                <Button size="$1" icon={Maximize2} onPress={() => setExpanded(true)} />
            </XStack>
            <TextArea
                value={text}
                onChange={handleChange}
                onChangeText={handleChange}
                onFocus={() => setIsEditing(true)}
                onBlur={() => { commit(); setIsEditing(false); }}
                minHeight={100}
                fontFamily="monospace"
                placeholder={placeholder}
            />
            {error ? <Text size="$2" color="$red10">{error}</Text> : null}
            <AlertDialog open={expanded} setOpen={(v) => { if (!v) commit(); setExpanded(!!v); }} hideAccept={true} width={"100vw"} height={"100vh"} p="$0">
                <YStack gap="$2" padding="$4" height="100%" width="100%">
                    <XStack justifyContent="space-between" alignItems="center">
                        <Text fow="700">{label}</Text>
                        <Button size="$2" icon={X} onPress={() => { commit(); setExpanded(false); }} />
                    </XStack>
                    <YStack flex={1} width="100%">
                        <TextArea
                            value={text}
                            onChange={handleChange}
                            onChangeText={handleChange}
                            onFocus={() => setIsEditing(true)}
                            onBlur={() => { commit(); setIsEditing(false); }}
                            fontFamily="monospace"
                            minHeight="100%"
                            flex={1}
                            placeholder={placeholder}
                        />
                        {error ? <Text size="$2" color="$red10">{error}</Text> : null}
                    </YStack>
                </YStack>
            </AlertDialog>
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
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (open) {
            setDraftSubsystems(deepClone(subsystems ?? []));
            setError(null);
        }
    }, [open, subsystems]);

    const updateSubsystemField = (index: number, field: string, value: any) => {
        startTransition(() => {
            setDraftSubsystems((prev) => {
                const next = [...(prev ?? [])];
                const current = next[index] ?? { monitors: [], actions: [] };
                next[index] = { ...current, [field]: value };
                return next;
            });
        });
    };

    const updateMonitorField = (subsystemIndex: number, monitorIndex: number, field: string, value: any) => {
        startTransition(() => {
            setDraftSubsystems((prev) => {
                const next = [...(prev ?? [])];
                const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
                const monitors = [...(currentSubsystem.monitors ?? [])];
                monitors[monitorIndex] = { ...(monitors[monitorIndex] ?? {}), [field]: value };
                next[subsystemIndex] = { ...currentSubsystem, monitors };
                return next;
            });
        });
    };

    const updateActionField = (subsystemIndex: number, actionIndex: number, field: string, value: any) => {
        startTransition(() => {
            setDraftSubsystems((prev) => {
                const next = [...(prev ?? [])];
                const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
                const actions = [...(currentSubsystem.actions ?? [])];
                actions[actionIndex] = { ...(actions[actionIndex] ?? {}), [field]: value };
                next[subsystemIndex] = { ...currentSubsystem, actions };
                return next;
            });
        });
    };

    const addSubsystem = () => startTransition(() => setDraftSubsystems((prev) => [...(prev ?? []), { name: `subsystem_${(prev?.length ?? 0) + 1}`, type: '', monitors: [], actions: [] }]));
    const removeSubsystem = (index: number) => startTransition(() => setDraftSubsystems((prev) => (prev ?? []).filter((_, i) => i !== index)));

    const addMonitor = (subsystemIndex: number) => startTransition(() => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const monitors = [...(currentSubsystem.monitors ?? []), { name: '', label: '', endpoint: '', units: '', connectionType: 'mqtt' }];
        next[subsystemIndex] = { ...currentSubsystem, monitors };
        return next;
    }));
    const removeMonitor = (subsystemIndex: number, monitorIndex: number) => startTransition(() => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const monitors = (currentSubsystem.monitors ?? []).filter((_, i) => i !== monitorIndex);
        next[subsystemIndex] = { ...currentSubsystem, monitors };
        return next;
    }));

    const addAction = (subsystemIndex: number) => startTransition(() => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const actions = [...(currentSubsystem.actions ?? []), { name: '', label: '', endpoint: '', connectionType: 'mqtt', payload: { type: 'str', value: '' } }];
        next[subsystemIndex] = { ...currentSubsystem, actions };
        return next;
    }));
    const removeAction = (subsystemIndex: number, actionIndex: number) => startTransition(() => setDraftSubsystems((prev) => {
        const next = [...(prev ?? [])];
        const currentSubsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
        const actions = (currentSubsystem.actions ?? []).filter((_, i) => i !== actionIndex);
        next[subsystemIndex] = { ...currentSubsystem, actions };
        return next;
    }));

    const getPayloadType = (payload: any): string => {
        if (Array.isArray(payload)) return 'select';
        const t = (payload?.type ?? '').toString();
        if (['slider', 'json-schema', 'select', 'str', 'string', 'int', 'integer', 'float', 'number', 'json'].includes(t)) return t;
        if (payload?.value !== undefined) return 'str';
        return 'str';
    };

    const setPayloadType = (subsystemIndex: number, actionIndex: number, nextType: string) => {
        startTransition(() => {
            setDraftSubsystems((prev) => {
                const next = [...(prev ?? [])];
                const subsystem = next[subsystemIndex] ?? { monitors: [], actions: [] };
                const actions = [...(subsystem.actions ?? [])];
                let payload: any;
                switch (nextType) {
                    case 'select':
                        payload = [{ label: 'Option 1', value: 'option1' }];
                        break;
                    case 'slider':
                        payload = { type: 'slider', min_value: 0, max_value: 100, step: 1, initial_value: 0, unit: '' };
                        break;
                    case 'json-schema':
                        payload = { type: 'json-schema', schema: {} };
                        break;
                    case 'int':
                    case 'integer':
                        payload = { type: 'int', value: 0 };
                        break;
                    case 'float':
                    case 'number':
                        payload = { type: 'float', value: 0 };
                        break;
                    case 'json':
                        payload = { type: 'json', value: {} };
                        break;
                    default:
                        payload = { type: nextType, value: '' };
                        break;
                }
                actions[actionIndex] = { ...(actions[actionIndex] ?? {}), payload };
                next[subsystemIndex] = { ...subsystem, actions };
                return next;
            });
        });
    };

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
            <YStack padding="$4" gap="$3" height="100%" overflow="hidden" width="100%" maxWidth="100%" alignSelf="stretch">
                <XStack justifyContent="space-between" alignItems="center" position="sticky" top={0} zIndex={1} backgroundColor="$background" paddingBottom="$2">
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

                <YStack gap="$3" width="100%" maxWidth="100%" overflow="auto" flex={1}>
                    {draftSubsystems?.map((subsystem, subsystemIndex) => (
                        <Tinted key={`sub-${subsystemIndex}`} width="100%">
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
                                        <YStack gap="$1" width="100%" maxWidth={220}>
                                            <Text size="$2" textAlign="center">Name</Text>
                                            <Input
                                                placeholder="Name"
                                                value={subsystem?.name ?? ''}
                                                onChange={(e) => updateSubsystemField(subsystemIndex, 'name', e.target.value)}
                                            />
                                        </YStack>
                                        <YStack gap="$1" width="100%" maxWidth={220}>
                                            <Text size="$2" textAlign="center">Type</Text>
                                            <Input
                                                placeholder="Type"
                                                value={subsystem?.type ?? ''}
                                                onChange={(e) => updateSubsystemField(subsystemIndex, 'type', e.target.value)}
                                            />
                                        </YStack>
                                        <YStack gap="$1" width="100%" maxWidth={220}>
                                            <Text size="$2" textAlign="center">Label</Text>
                                            <Input
                                                placeholder="Label"
                                                value={subsystem?.label ?? ''}
                                                onChange={(e) => updateSubsystemField(subsystemIndex, 'label', e.target.value)}
                                            />
                                        </YStack>
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
                                            <Tinted key={`sub-${subsystemIndex}-mon-${monitorIndex}`} width="100%">
                                                <CollapsibleSection title={monitor?.label || monitor?.name || `Monitor ${monitorIndex + 1}`}>
                                                    <YStack gap="$2" padding="$2" width="100%">
                                                        <XStack justifyContent="flex-end" alignItems="center">
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
                                                        <XStack gap="$2" flexWrap="wrap" width="100%">
                                                            <YStack gap="$1" width="100%" maxWidth={200}>
                                                                <Text size="$2" textAlign="center">Name</Text>
                                                                <Input
                                                                    placeholder="Name"
                                                                    value={monitor?.name ?? ''}
                                                                    onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'name', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" width="100%" maxWidth={200}>
                                                                <Text size="$2" textAlign="center">Label</Text>
                                                                <Input
                                                                    placeholder="Label"
                                                                    value={monitor?.label ?? ''}
                                                                    onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'label', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" flex={1} minWidth={240}>
                                                                <Text size="$2" textAlign="center">Endpoint</Text>
                                                                <Input
                                                                    placeholder="Endpoint"
                                                                    value={monitor?.endpoint ?? ''}
                                                                    onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'endpoint', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" width="100%" maxWidth={120}>
                                                                <Text size="$2" textAlign="center">Units</Text>
                                                                <Input
                                                                    placeholder="Units"
                                                                    value={monitor?.units ?? ''}
                                                                    onChange={(e) => updateMonitorField(subsystemIndex, monitorIndex, 'units', e.target.value)}
                                                                />
                                                            </YStack>
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
                                            <Tinted key={`sub-${subsystemIndex}-act-${actionIndex}`} width="100%">
                                                <CollapsibleSection title={action?.label || action?.name || `Action ${actionIndex + 1}`}>
                                                    <YStack gap="$2" padding="$2" width="100%">
                                                        <XStack justifyContent="flex-end" alignItems="center">
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
                                                        <XStack gap="$2" flexWrap="wrap" width="100%">
                                                            <YStack gap="$1" width="100%" maxWidth={200}>
                                                                <Text size="$2" textAlign="center">Name</Text>
                                                                <Input
                                                                    placeholder="Name"
                                                                    value={action?.name ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'name', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" width="100%" maxWidth={200}>
                                                                <Text size="$2" textAlign="center">Label</Text>
                                                                <Input
                                                                    placeholder="Label"
                                                                    value={action?.label ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'label', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" flex={1} minWidth={240}>
                                                                <Text size="$2" textAlign="center">Description</Text>
                                                                <Input
                                                                    placeholder="Description"
                                                                    value={action?.description ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'description', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" flex={1} minWidth={240}>
                                                                <Text size="$2" textAlign="center">Endpoint</Text>
                                                                <Input
                                                                    placeholder="Endpoint"
                                                                    value={action?.endpoint ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'endpoint', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" width="100%" maxWidth={160}>
                                                                <Text size="$2" textAlign="center">Connection type</Text>
                                                                <Input
                                                                    placeholder="Connection type"
                                                                    value={action?.connectionType ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'connectionType', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" width="100%" maxWidth={140}>
                                                                <Text size="$2" textAlign="center">Mode</Text>
                                                                <Input
                                                                    placeholder="Mode"
                                                                    value={action?.mode ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'mode', e.target.value)}
                                                                />
                                                            </YStack>
                                                            <YStack gap="$1" width="100%" maxWidth={160}>
                                                                <Text size="$2" textAlign="center">Reply timeout (ms)</Text>
                                                                <Input
                                                                    placeholder="Reply timeout (ms)"
                                                                    value={action?.replyTimeoutMs ?? ''}
                                                                    onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'replyTimeoutMs', e.target.value)}
                                                                />
                                                            </YStack>
                                                        </XStack>
                                                        {/* Payload editor */}
                                                        <YStack gap="$2" width="100%">
                                                            <Text fow="600">Payload</Text>
                                                            <XStack gap="$2" flexWrap="wrap" alignItems="center">
                                                                <Text size="$2">Type</Text>
                                                            <Select
                                                                value={getPayloadType(action?.payload)}
                                                                onValueChange={(val) => setPayloadType(subsystemIndex, actionIndex, val)}
                                                                disablePreventBodyScroll
                                                            >
                                                                <Select.Trigger iconAfter={ChevronDown} width={180}>
                                                                    <Select.Value placeholder="Type" />
                                                                </Select.Trigger>
                                                                <Select.Content zIndex={1000000}>
                                                                    <Select.Viewport>
                                                                        <Select.Group>
                                                                            {['str', 'int', 'float', 'number', 'json', 'select', 'slider', 'json-schema'].map((opt) => (
                                                                                <Select.Item key={opt} value={opt}>
                                                                                    <Select.ItemText>{opt}</Select.ItemText>
                                                                                    <Select.ItemIndicator marginLeft="auto">
                                                                                        <Check size={16} />
                                                                                    </Select.ItemIndicator>
                                                                                </Select.Item>
                                                                            ))}
                                                                        </Select.Group>
                                                                    </Select.Viewport>
                                                                </Select.Content>
                                                            </Select>
                                                            </XStack>

                                                            {(() => {
                                                                const pType = getPayloadType(action?.payload);
                                                                if (pType === 'select') {
                                                                    const options = Array.isArray(action?.payload) ? action.payload : [];
                                                                    return (
                                                                        <YStack gap="$2">
                                                                            {options.map((opt, optIndex) => (
                                                                                <XStack key={`opt-${optIndex}`} gap="$2" alignItems="center">
                                                                                    <Input
                                                                                        placeholder="Label"
                                                                                        value={opt?.label ?? ''}
                                                                                        onChange={(e) => {
                                                                                            const next = options.map((o, i) => i === optIndex ? { ...o, label: e.target.value } : o);
                                                                                            updateActionField(subsystemIndex, actionIndex, 'payload', next);
                                                                                        }}
                                                                                    />
                                                                                    <Input
                                                                                        placeholder="Value"
                                                                                        value={opt?.value ?? ''}
                                                                                        onChange={(e) => {
                                                                                            const next = options.map((o, i) => i === optIndex ? { ...o, value: e.target.value } : o);
                                                                                            updateActionField(subsystemIndex, actionIndex, 'payload', next);
                                                                                        }}
                                                                                    />
                                                                                    <Button size="$2" icon={Trash2} theme="red" onPress={() => {
                                                                                        const next = options.filter((_, i) => i !== optIndex);
                                                                                        updateActionField(subsystemIndex, actionIndex, 'payload', next);
                                                                                    }}>
                                                                                        Remove
                                                                                    </Button>
                                                                                </XStack>
                                                                            ))}
                                                                            <Button size="$2" icon={Plus} onPress={() => updateActionField(subsystemIndex, actionIndex, 'payload', [...options, { label: 'Option', value: '' }])}>
                                                                                Add option
                                                                            </Button>
                                                                        </YStack>
                                                                    );
                                                                }

                                                                if (pType === 'slider') {
                                                                    const slider = action?.payload ?? {};
                                                                    const setSliderField = (field: string, val: any) => {
                                                                        updateActionField(subsystemIndex, actionIndex, 'payload', { ...(action?.payload ?? {}), [field]: val, type: 'slider' });
                                                                    };
                                                                    return (
                                                                        <XStack gap="$2" flexWrap="wrap">
                                                                            <Input placeholder="Min" value={slider.min_value ?? ''} onChange={(e) => setSliderField('min_value', e.target.value)} />
                                                                            <Input placeholder="Max" value={slider.max_value ?? ''} onChange={(e) => setSliderField('max_value', e.target.value)} />
                                                                            <Input placeholder="Step" value={slider.step ?? ''} onChange={(e) => setSliderField('step', e.target.value)} />
                                                                            <Input placeholder="Initial" value={slider.initial_value ?? ''} onChange={(e) => setSliderField('initial_value', e.target.value)} />
                                                                            <Input placeholder="Unit" value={slider.unit ?? ''} onChange={(e) => setSliderField('unit', e.target.value)} />
                                                                        </XStack>
                                                                    );
                                                                }

                                                                if (pType === 'json-schema') {
                                                                    const schemaVal = action?.payload?.schema ?? {};
                                                                    return (
                                                                        <JsonField
                                                                            label="Schema (JSON)"
                                                                            value={schemaVal}
                                                                            onChange={(v) => updateActionField(subsystemIndex, actionIndex, 'payload', { type: 'json-schema', schema: v ?? {} })}
                                                                            placeholder='{"type":"object","properties":{}}'
                                                                        />
                                                                    );
                                                                }

                                                                // default scalar/json
                                                                if (pType === 'json') {
                                                                    return (
                                                                        <JsonField
                                                                            label="Value (JSON)"
                                                                            value={action?.payload?.value ?? {}}
                                                                            onChange={(v) => updateActionField(subsystemIndex, actionIndex, 'payload', { ...(action?.payload ?? {}), type: 'json', value: v ?? {} })}
                                                                            placeholder='{"key":"value"}'
                                                                        />
                                                                    );
                                                                }

                                                                return (
                                                                    <XStack gap="$2" flexWrap="wrap">
                                                                        <Input
                                                                            placeholder="Value"
                                                                            value={action?.payload?.value ?? ''}
                                                                            onChange={(e) => updateActionField(subsystemIndex, actionIndex, 'payload', { ...(action?.payload ?? {}), type: pType, value: e.target.value })}
                                                                            flex={1}
                                                                        />
                                                                    </XStack>
                                                                );
                                                            })()}
                                                        </YStack>
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
