import React, { useState, useEffect, useMemo } from 'react'
import { YStack, XStack, Text, Button, ScrollView, Spinner } from '@my/ui'
import {
    LineChart as LineChartR,
    AreaChart as AreaChartR,
    Line,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts'
import { API } from 'protobase'
import { useThemeSetting } from '@tamagui/next-theme'

interface HistoryEntry {
    id: number
    card_id: string
    card_name: string
    value: any
    created_at: number
}

interface HistoryEditorProps {
    boardId: string
    cardId: string
    cardName: string
}

type TimeRange = '1min' | '1h' | '1d' | '1w' | '1m' | '1y'
type ChartType = 'line' | 'area'

const TIME_RANGES: { key: TimeRange; label: string; ms: number }[] = [
    { key: '1min', label: '1 min', ms: 60 * 1000 },
    { key: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
    { key: '1d', label: '1 day', ms: 24 * 60 * 60 * 1000 },
    { key: '1w', label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
    { key: '1m', label: '1 month', ms: 30 * 24 * 60 * 60 * 1000 },
    { key: '1y', label: '1 year', ms: 365 * 24 * 60 * 60 * 1000 },
]

const formatTimestamp = (ts: number, range: TimeRange): string => {
    const date = new Date(ts)
    switch (range) {
        case '1min':
        case '1h':
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        case '1d':
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        case '1w':
        case '1m':
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        case '1y':
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
        default:
            return date.toLocaleString()
    }
}

const formatFullTimestamp = (ts: number): string => {
    return new Date(ts).toLocaleString()
}

const isNumericValue = (value: any): boolean => {
    if (typeof value === 'number') return true
    if (typeof value === 'string') {
        const num = parseFloat(value)
        return !isNaN(num) && isFinite(num)
    }
    return false
}

const getNumericValue = (value: any): number => {
    if (typeof value === 'number') return value
    return parseFloat(value)
}

const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
}

// Timeline component for non-numeric values
const Timeline = ({ data, range }: { data: HistoryEntry[]; range: TimeRange }) => {
    const { resolvedTheme } = useThemeSetting()
    const isDark = resolvedTheme === 'dark'

    if (data.length === 0) {
        return (
            <YStack f={1} ai="center" jc="center" p="$4">
                <Text color="$gray10">No history data available for this time range</Text>
            </YStack>
        )
    }

    return (
        <ScrollView f={1}>
            <YStack gap="$2" p="$3">
                {data.map((entry, index) => (
                    <XStack
                        key={entry.id}
                        gap="$3"
                        p="$3"
                        borderRadius="$3"
                        backgroundColor={isDark ? '$gray3' : '$gray2'}
                        borderLeftWidth={3}
                        borderLeftColor="$color8"
                    >
                        <YStack minWidth={140}>
                            <Text fontSize="$2" color="$gray11" fontFamily="$mono">
                                {formatFullTimestamp(entry.created_at)}
                            </Text>
                        </YStack>
                        <YStack f={1}>
                            <Text
                                fontSize="$3"
                                color="$color"
                                fontFamily={typeof entry.value === 'object' ? '$mono' : undefined}
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}
                            >
                                {formatValue(entry.value)}
                            </Text>
                        </YStack>
                    </XStack>
                ))}
            </YStack>
        </ScrollView>
    )
}

export const HistoryEditor = ({ boardId, cardId, cardName }: HistoryEditorProps) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('1h')
    const [chartType, setChartType] = useState<ChartType>('line')
    const [history, setHistory] = useState<HistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchHistory = async () => {
        setLoading(true)
        setError(null)

        try {
            const rangeConfig = TIME_RANGES.find(r => r.key === timeRange)
            const from = Date.now() - (rangeConfig?.ms ?? 60 * 60 * 1000)

            const response = await API.get(
                `/api/core/v1/boards/${boardId}/cards/${encodeURIComponent(cardId)}/history?from=${from}`
            )

            if (response.data?.history) {
                // Sort by created_at ascending for charts
                const sorted = [...response.data.history].sort((a, b) => a.created_at - b.created_at)
                setHistory(sorted)
            } else {
                setHistory([])
            }
        } catch (err: any) {
            console.error('Error fetching history:', err)
            setError(err.message || 'Failed to fetch history')
            setHistory([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHistory()
        // Refresh every 30 seconds
        const interval = setInterval(fetchHistory, 30000)
        return () => clearInterval(interval)
    }, [boardId, cardId, timeRange])

    // Determine if values are numeric
    const isNumeric = useMemo(() => {
        if (history.length === 0) return false
        return history.every(entry => isNumericValue(entry.value))
    }, [history])

    // Prepare chart data
    const chartData = useMemo(() => {
        if (!isNumeric) return []
        return history.map(entry => ({
            time: formatTimestamp(entry.created_at, timeRange),
            value: getNumericValue(entry.value)
        }))
    }, [history, isNumeric, timeRange])

    // For timeline, show newest first
    const timelineData = useMemo(() => {
        return [...history].reverse()
    }, [history])

    return (
        <YStack f={1} gap="$3" width="100%">
            {/* Controls */}
            <XStack gap="$2" flexWrap="wrap" ai="center" jc="space-between" width="100%">
                <XStack gap="$2" flexWrap="wrap">
                    {TIME_RANGES.map(range => (
                        <Button
                            key={range.key}
                            size="$2"
                            backgroundColor={timeRange === range.key ? '$color8' : '$gray4'}
                            color={timeRange === range.key ? 'white' : '$color'}
                            borderRadius="$2"
                            onPress={() => setTimeRange(range.key)}
                            pressStyle={{ opacity: 0.8 }}
                        >
                            {range.label}
                        </Button>
                    ))}
                </XStack>

                {isNumeric && (
                    <XStack gap="$2">
                        <Button
                            size="$2"
                            backgroundColor={chartType === 'line' ? '$color8' : '$gray4'}
                            color={chartType === 'line' ? 'white' : '$color'}
                            borderRadius="$2"
                            onPress={() => setChartType('line')}
                            pressStyle={{ opacity: 0.8 }}
                        >
                            Line
                        </Button>
                        <Button
                            size="$2"
                            backgroundColor={chartType === 'area' ? '$color8' : '$gray4'}
                            color={chartType === 'area' ? 'white' : '$color'}
                            borderRadius="$2"
                            onPress={() => setChartType('area')}
                            pressStyle={{ opacity: 0.8 }}
                        >
                            Area
                        </Button>
                    </XStack>
                )}
            </XStack>

            {/* Content */}
            <YStack f={1} width="100%" backgroundColor="$bgPanel" borderRadius="$3" overflow="hidden">
                {loading ? (
                    <YStack f={1} ai="center" jc="center" p="$4">
                        <Spinner size="large" color="$color8" />
                        <Text color="$gray10" mt="$2">Loading history...</Text>
                    </YStack>
                ) : error ? (
                    <YStack f={1} ai="center" jc="center" p="$4">
                        <Text color="$red10">{error}</Text>
                        <Button mt="$3" onPress={fetchHistory}>Retry</Button>
                    </YStack>
                ) : history.length === 0 ? (
                    <YStack f={1} ai="center" jc="center" p="$4">
                        <Text color="$gray10">No history data available</Text>
                        <Text color="$gray9" fontSize="$2" mt="$2">
                            History will appear here when the card value changes
                        </Text>
                    </YStack>
                ) : isNumeric ? (
                    <YStack f={1} p="$3" minHeight={300} width="100%">
                        <YStack f={1} width="100%">
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'line' ? (
                                    <LineChartR data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray6)" />
                                        <XAxis 
                                            dataKey="time" 
                                            stroke="var(--gray9)"
                                            fontSize={12}
                                            tickLine={false}
                                        />
                                        <YAxis 
                                            stroke="var(--gray9)"
                                            fontSize={12}
                                            tickLine={false}
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--background)', 
                                                border: '1px solid var(--gray6)',
                                                borderRadius: 8
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            stroke="var(--color8)"
                                            strokeWidth={2}
                                            dot={{ fill: 'var(--color8)', strokeWidth: 0, r: 4 }}
                                            activeDot={{ r: 6, fill: 'var(--color8)' }}
                                            isAnimationActive={false}
                                        />
                                    </LineChartR>
                                ) : (
                                    <AreaChartR data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray6)" />
                                        <XAxis 
                                            dataKey="time" 
                                            stroke="var(--gray9)"
                                            fontSize={12}
                                            tickLine={false}
                                        />
                                        <YAxis 
                                            stroke="var(--gray9)"
                                            fontSize={12}
                                            tickLine={false}
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--background)', 
                                                border: '1px solid var(--gray6)',
                                                borderRadius: 8
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="var(--color8)"
                                            fill="var(--color8)"
                                            fillOpacity={0.3}
                                            strokeWidth={2}
                                            isAnimationActive={false}
                                        />
                                    </AreaChartR>
                                )}
                            </ResponsiveContainer>
                        </YStack>
                        <Text color="$gray9" fontSize="$2" ta="center" mt="$2">
                            {history.length} data points
                        </Text>
                    </YStack>
                ) : (
                    <Timeline data={timelineData} range={timeRange} />
                )}
            </YStack>
        </YStack>
    )
}

