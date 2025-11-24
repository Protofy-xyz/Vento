import { YStack, Text } from '@my/ui';
import { BarChart as BarChartR, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface BarChartProps {
    title: string;
    id: string;
    data: any[];
    dataKey: string;
    nameKey: string;
    colors: string[];
    tooltipFormatter?: (value: string) => string;
    isAnimationActive?: boolean;
    aspect?:any
}

export const BarChart: React.FC<BarChartProps> = ({
    data,
    dataKey,
    nameKey,
    colors,
    tooltipFormatter = (value) => `${value}`,
    isAnimationActive = false,
    aspect = 1
}) => {
    return (
        <YStack flex={1}>
            {Array.isArray(data) && data.length > 0 ? (
                <ResponsiveContainer aspect={parseFloat(aspect)}>
                    <BarChartR data={data}>
                        <XAxis dataKey={nameKey} />
                        <YAxis />
                        <Tooltip cursor={{ fill: "var(--bgContent)" }} content={(props) => <ChartTooltip {...props} tooltipFormatter={tooltipFormatter} />} />
                        <Bar
                            dataKey={dataKey}
                            isAnimationActive={isAnimationActive}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Bar>
                    </BarChartR>
                </ResponsiveContainer>
            ) : (
                <YStack>
                    <Text>No data available</Text>
                </YStack>
            )}
        </YStack>
    );
};
