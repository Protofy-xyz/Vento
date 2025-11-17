import { YStack, Text } from "@my/ui";
import { SelectList } from "./SelectList";
import { useAgents } from '@extensions/boards/hooks/useAgents';


export const AgentsSelector = ({
    value,
    onChange,
    placeholder,
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
}) => {
    const { agents, loading, error } = useAgents()
    const elements = (agents || []).map((a: any) => a.name).filter(Boolean)

    if (loading) {
        return (
            <Text size="$2" mx="10px">
                Loading agents...
            </Text>
        )
    }

    if (error) {
        return (
            <Text size="$2" mx="10px" color="$red10">
                {error}
            </Text>
        )
    }

    if (!elements.length) {
        return (
            <Text size="$2" mx="10px" color="$color11">
                No agents available.
            </Text>
        )
    }

    return (
        <YStack>
            <SelectList
                title={placeholder || 'Agent'}
                elements={elements}
                value={value}
                onValueChange={(v) => onChange(v)}
                selectorStyle={{
                    normal: { backgroundColor: "$gray1", borderColor: "$gray7" },
                    hover: { backgroundColor: "$gray2" },
                }}
            />
        </YStack>
    )
}