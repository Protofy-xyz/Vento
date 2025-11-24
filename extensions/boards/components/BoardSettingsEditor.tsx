import { YStack, Text, Input, XStack, Button, Spinner, Checkbox } from "@my/ui"
import { SelectList } from "protolib/components/SelectList"
import { Tinted } from "protolib/components/Tinted"
import { useEffect, useState } from "react"
import { Check } from "@tamagui/lucide-icons"
import { API } from "protobase"
import { useThemeSetting } from '@tamagui/next-theme'
import { MultiSelectList } from "protolib/components/MultiSelectList"

const columnWidth = 170

const ColumnTitle = ({ children }) => <Text
    w={columnWidth}
    fos="$4"
>
    {children}
</Text>

const ColInput = ({ ...props }) => <Input
    borderWidth={0}
    outlineColor={"$gray8"}
    placeholderTextColor="$gray9"
    {...props}
/>

export const BoardSettingsEditor = ({ settings, users = [], onSave }) => {

    const [currentSettings, setCurrentSettings] = useState(settings)
    const [currentUsers, setCurrentUsers] = useState(users || [])
    const [availableUsers, setAvailableUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [loading, setLoading] = useState(false)

    const BG_COLOR = "$bgPanel"

    useEffect(() => {
        let cancelled = false
        const loadUsers = async () => {
            setLoadingUsers(true)
            try {
                const response = await API.get('/api/core/v1/groups')
                const groups = response?.data?.items ?? response?.data ?? []
                const groupNames = Array.isArray(groups) ? groups.map((g: any) => g?.name ?? g).filter(Boolean) : []
                if (!cancelled) {
                    setAvailableUsers(groupNames)
                }
            } catch (_e) {
                if (!cancelled) {
                    setAvailableUsers([])
                }
            } finally {
                if (!cancelled) {
                    setLoadingUsers(false)
                }
            }
        }
        loadUsers()
        return () => {
            cancelled = true
        }
    }, [])

    const clearSettings = (stt) => {
        const cleaned = { ...stt }
        if (cleaned.margin) {
            if (!Array.isArray(cleaned.margin) || cleaned.margin.length !== 2 || cleaned.margin.every(m => m == "")) {
                delete cleaned.margin
            }
            else {
                cleaned.margin = cleaned.margin.map(m => m.length ? parseInt(m) : 0)
            }
        }
        if (cleaned.backgroundImage?.trim() === "") {
            delete cleaned.backgroundImage
        }
        if (cleaned.compactType === "default" || !cleaned.compactType) {
            delete cleaned.compactType
        }
        if (Object.keys(cleaned).includes("allowOverlap")) {
            if ((cleaned.allowOverlap != true && cleaned.allowOverlap != false)) {
                delete cleaned.allowOverlap
            }
        }
        return cleaned
    }

    const onSaveSettigns = async () => {
        setLoading(true)
        let cleanedSettings = clearSettings(currentSettings)
        const cleanedUsers = currentUsers?.length ? currentUsers : undefined
        await onSave(cleanedSettings, cleanedUsers)
        setLoading(false)
    }

    return <YStack gap="$6" f={1} padding="$4">
        <YStack gap="$4" f={1}>
            <XStack alignItems="center">
                <ColumnTitle>Background Image URL</ColumnTitle>
                <ColInput
                    backgroundColor={BG_COLOR}
                    f={1}
                    borderColor={"$gray6"}
                    borderWidth={1}
                    placeholder="URL or path to background image"
                    value={currentSettings?.backgroundImage}
                    onChangeText={(text) => setCurrentSettings({ ...currentSettings, backgroundImage: text })}
                />
            </XStack>
            <XStack alignItems="center">
                <ColumnTitle>Autoplay</ColumnTitle>
                <Checkbox
                    w="$2"
                    h="$2"
                    focusStyle={{ outlineWidth: 0 }}
                    checked={currentSettings?.autoplay ?? false}
                    onCheckedChange={(checked) => setCurrentSettings({ ...currentSettings, autoplay: checked })}
                    className="no-drag"
                    borderColor={"$gray6"}
                    backgroundColor={BG_COLOR}
                >
                    <Checkbox.Indicator>
                        <Check size={16} />
                    </Checkbox.Indicator>
                </Checkbox>
            </XStack>
            <XStack alignItems="center">
                <ColumnTitle>Show board UI on play</ColumnTitle>
                <Checkbox
                    w="$2"
                    h="$2"
                    focusStyle={{ outlineWidth: 0 }}
                    checked={currentSettings?.showBoardUIOnPlay ?? false}
                    onCheckedChange={(checked) => setCurrentSettings({ ...currentSettings, showBoardUIOnPlay: checked })}
                    className="no-drag"
                    backgroundColor={BG_COLOR}
                    borderColor={"$gray6"}
                >
                    <Checkbox.Indicator>
                        <Check size={16} />
                    </Checkbox.Indicator>
                </Checkbox>
            </XStack>
            <XStack alignItems="center">
                <ColumnTitle>Show board UI while playing</ColumnTitle>
                <Checkbox
                    w="$2"
                    h="$2"
                    focusStyle={{ outlineWidth: 0 }}
                    checked={currentSettings?.showBoardUIWhilePlaying ?? false}
                    onCheckedChange={(checked) => setCurrentSettings({ ...currentSettings, showBoardUIWhilePlaying: checked })}
                    className="no-drag"
                    borderWidth={1}
                    backgroundColor={BG_COLOR}
                    borderColor={"$gray6"}
                >
                    <Checkbox.Indicator>
                        <Check size={16} />
                    </Checkbox.Indicator>
                </Checkbox>
            </XStack>
            <XStack alignItems="center">
                <ColumnTitle>{"Margin"}</ColumnTitle>
                <ColInput
                    backgroundColor={BG_COLOR}
                    w={60}
                    mr="$2"
                    maxLength={3}
                    borderWidth={1}
                    borderColor={"$gray6"}
                    placeholder="X"
                    value={currentSettings?.margin?.[0]?.toString() || ""}
                    onChangeText={(text) => setCurrentSettings({ ...currentSettings, margin: [text != "" && !isNaN(parseInt(text)) ? parseInt(text).toString() : "", currentSettings?.margin?.[1] || ""] })}
                />
                <ColInput
                    backgroundColor={BG_COLOR}
                    borderColor={"$gray6"}
                    borderWidth={1}
                    w={60}
                    maxLength={3}
                    placeholder="Y"
                    value={currentSettings?.margin?.[1]?.toString() || ""}
                    onChangeText={(text) => setCurrentSettings({ ...currentSettings, margin: [currentSettings?.margin?.[0] || "", text != "" && !isNaN(parseInt(text)) ? parseInt(text).toString() : ""] })}
                />
            </XStack>
            <XStack alignItems="center">
                <ColumnTitle>Overlap</ColumnTitle>
                <YStack w={127}>
                    <SelectList
                        triggerProps={{ backgroundColor: BG_COLOR, borderWidth: 1, borderColor: "$gray6" }}
                        title={"Overlap"}
                        value={currentSettings?.allowOverlap == true ? "yes" : currentSettings?.allowOverlap == false ? "no" : "default"}
                        elements={[{ value: "default", caption: "default" }, { value: true, caption: "yes" }, { value: false, caption: "no" }]}
                        setValue={(value) => setCurrentSettings({ ...currentSettings, allowOverlap: value })}
                    />
                </YStack>
            </XStack>
            <XStack alignItems="center">
                <ColumnTitle>{"Compact type"}</ColumnTitle>
                <YStack w={127}>
                    <SelectList
                        triggerProps={{ backgroundColor: BG_COLOR, borderWidth: 1, borderColor: "$gray6"}}
                        title={"Compact Type"}
                        value={currentSettings?.compactType || "default"}
                        placeholder="Select compact type"
                        elements={[{ value: "default", caption: "default" }, { value: "vertical", caption: "vertical" }, { value: "horizontal", caption: "horizontal" }]}
                        setValue={(value) => setCurrentSettings({ ...currentSettings, compactType: value })}
                    />
                </YStack>
            </XStack>
            <XStack alignItems="flex-start">
                <ColumnTitle>Visible to users</ColumnTitle>
                <YStack gap="$2" f={1}>
                    {loadingUsers && <Spinner size="small" />}
                    {!loadingUsers && (
                        <>
                            <MultiSelectList
                                choices={availableUsers}
                                defaultSelections={currentUsers}
                                onSetSelections={(selections) => setCurrentUsers(selections)}
                            />
                            <Text color="$gray9" fow="300">
                                Whitelist: only selected users can see this board. Leave empty to allow everyone.
                            </Text>
                            {(!availableUsers || availableUsers.length === 0) && (
                                <Text color="$gray9">No groups available</Text>
                            )}
                        </>
                    )}
                </YStack>
            </XStack>
        </YStack>
        <Tinted>
            <Button
                onPress={onSaveSettigns}
            >
                Save
                {loading && <Spinner />}
            </Button>
        </Tinted>
    </YStack>
}
