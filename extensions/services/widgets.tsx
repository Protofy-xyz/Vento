import { YStack, Text } from '@my/ui';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { API } from 'protobase'
import { useState, useEffect, useRef, forwardRef } from 'react';
import { useRemoteStateList } from 'protolib/lib/useRemoteState';
import { ServiceModel } from './servicesSchemas';
import AsyncView from 'protolib/components/AsyncView';
import { DashboardCard } from 'protolib/components/DashboardCard';
import { PieChart } from 'protolib/components/PieChart';
import { LineChart, Cpu } from 'lucide-react'
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRootTheme } from '@tamagui/next-theme'

const fetch = async (fn) => {
    const services = await API.get('/api/core/v1/services')
    fn(services)
}

export const ServiceMemoryUsageChart = ({ title, id }) => {
    const [servicesData, setServicesData] = useRemoteStateList(undefined, fetch, ServiceModel.getNotificationsTopic(), ServiceModel, true);
    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA00FF", "#FF007F", "#7B00FF", "#00FF7F", "#FF4500", "#4682B4"]

    if (!servicesData?.data?.items) return null;

    return (
        <PieChart
            title={title}
            id={id}
            data={servicesData.data.items}
            dataKey="memory"
            nameKey="name"
            colors={COLORS}
            tooltipFormatter={(value) => `${(value / (1024 * 1024)).toFixed(2)} MB`}
            isAnimationActive={false}
        />
    );
};

export const CenterCard = forwardRef(({ highlighted = false, status, title, hideTitle, hideFrame, id, children, onPress = () => { }, onDoubleClick, ...props }: any, ref: any) => {
    return (
        <DashboardCard ref={ref} highlighted={highlighted} status={status} hideTitle={hideTitle} hideFrame={hideFrame} title={title} id={id} {...props}>
            <YStack height="100%" onPress={onPress} onDoubleClick={onDoubleClick} borderRadius={10} backgroundColor="$bgColor" flex={1}>
                {children}
            </YStack>
        </DashboardCard>
    );
});

export const BasicCard = ({ title, id, children }) => {
    return (
        <DashboardCard title={title} id={id}>
            <YStack borderRadius={10} backgroundColor="$bgColor" flex={1}>
                <YStack width="100%">
                    {children}
                </YStack>
            </YStack>
        </DashboardCard>
    );
}



export const getHTML = (html, viewLib, data) => {
    try {
        const wrapper = new Function('data', `
            ${viewLib}
            ${html}
        `);
        return wrapper(data);
    } catch (e) {
        console.error(e);
        return '';
    }
}

let viewLib = null;
let pendingViewLibRequest = null;
const requestViewLib = (cb) => {
    if (viewLib) {
        cb(viewLib);
        return;
    }
    //accumulate cb calls if multiple requests are made
    if (pendingViewLibRequest) {
        pendingViewLibRequest.push(cb);
        return;
    }

    pendingViewLibRequest = [cb];
    API.get('/api/core/v1/viewLib', null, true).then((res) => {
        viewLib = res.data;
        pendingViewLibRequest.forEach((callback) => callback(viewLib));
        pendingViewLibRequest = null;
    }).catch((err) => {
        console.error('Failed to load view library:', err);
        pendingViewLibRequest.forEach((callback) => callback(null));
        pendingViewLibRequest = null;
    });
}

const cardState = {}
export const HTMLView = ({ html, data, setData = () => { }, ...props }) => {
    const [loaded, setLoaded] = useState(viewLib !== null);
    const [uuid, setuuid] = useState(() => uuidv4());
    const [containerKey, setContainerKey] = useState(() => uuidv4());
    const displayedHTML = useRef();
    const [theme, setTheme] = useRootTheme();

    if (cardState[uuid] === undefined) {
        cardState[uuid] = {};
    }

    const cardType = html.match(/^\/\/ ?@([^\n\r]*)/);

    if (cardType && cardType[1]) {
        const cardTypeMatch = html.match(/^[ \t\r\n]*\/\/ ?@([^\n\r]*)/m);

        const cardTypeValue = cardTypeMatch ? cardTypeMatch[1].trim() : null;

        if (cardTypeValue === 'card/react' || cardTypeValue === 'card/reactframe') {
            html = 'reactCard(`' + html.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`, data.domId, data)';
        }
        // Do something with the card type
    }

    const isReactWidget = (html) => html.includes('reactCard') || html.includes('//@react') || html.includes('//@card/react') || html.includes('// @react') || html.includes('// @card/react');

    const dataForCard = {
        ...data,
        theme,
        domId: uuid,
        setCardData: (obj) => setData(obj),
        cardState: cardState[uuid],
        setCardState: (state) => {
            if (cardState[uuid]) Object.assign(cardState[uuid], state);
        }
    };

    const htmlContainerRef = useRef(null);


    useEffect(() => {
        if (isReactWidget(html)) {
            setContainerKey(uuidv4());
        }
    }, [html]);

    useEffect(() => {
        if (!loaded || !viewLib) return;
        if (!isReactWidget(html)) return;

        const el = document.getElementById(uuid);
        if (!el) {
            console.warn("⚠️ div not ready yet, skipping reactCard execution for", uuid);
            return;
        }

        console.log("🔁 Running getHTML (ReactCard) for:", uuid);

        try {
            getHTML(html, viewLib, dataForCard);
        } catch (err) {
            console.error("❌ Error executing getHTML for reactCard:", err);
        }
    }, [containerKey, loaded, viewLib]);

    // Este useEffect es clave para ReactCards ya montadas
    useEffect(() => {
        //console.log('Updating HTMLView for card:', uuid, 'with data:', dataForCard);
        if (!loaded || !viewLib) return;


        if (html == displayedHTML.current && isReactWidget(html) && window._reactWidgets?.[uuid]) {
            //console.log("React card already mounted, skipping update");
            // Ya montado antes y el codigo no ha cambiado
            window.updateReactCardProps?.(uuid, dataForCard);
            return
        }
        console.log("not a react card or code changed, updating...");
        displayedHTML.current = html;
        if (htmlContainerRef.current && !isReactWidget(html)) {
            // HTML normal o tarjeta react sin redenrizar, siempre regenerar
            const innerHtml = getHTML(html, viewLib, dataForCard);
            htmlContainerRef.current.innerHTML = innerHtml;
        }

    }, [html, JSON.stringify(data), viewLib, loaded]);

    // Cargar viewLib
    useEffect(() => {
        if (!loaded) {
            requestViewLib((lib) => {
                if (!lib) {
                    console.error('Failed to load view library');
                    return;
                }
                viewLib = lib;
                setLoaded(true);
            });
        }

        return () => {
            delete cardState[uuid]; // Clean up
        };
    }, []);

    return <div id={uuid} key={containerKey} ref={htmlContainerRef} {...props} />;
};

export const CardValue = ({ Icon, id = null, value, setData = (data, id) => { }, html, color = "var(--color7)", ...props }) => {

    return (
        <YStack width="100%" height="100%" alignItems='center' justifyContent='center'>
            {html?.length > 0 && <HTMLView style={{ width: "100%", height: '100%' }} html={html} data={{ ...props, icon: Icon, value: value, color: color }} setData={(data) => {
                setData(data, id)
            }} />}
            {!html?.length && <>
                {typeof Icon === 'string' ? <div style={{
                    width: "48px",
                    height: "48px",
                    backgroundColor: color,
                    maskImage: `url(${Icon})`,
                    WebkitMaskImage: `url(${Icon})`,
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskPosition: "center",
                    WebkitMaskPosition: "center"
                }} /> :
                    <Icon color={color} size={48} strokeWidth={1.75} />}
                <Text userSelect="none" mt={10} fontSize={30} fontWeight="bold" color="$primary">
                    {React.isValidElement(value) || typeof value === 'string' || typeof value == 'number' ? value : 'N/A'}
                </Text>
            </>}
        </YStack>
    );
}

export const TotalMemoryUsage = ({ title, id }) => {
    const [servicesData, setServicesData] = useRemoteStateList(undefined, fetch, ServiceModel.getNotificationsTopic(), ServiceModel, true);
    const [totalMemory, setTotalMemory] = useState(0);

    useEffect(() => {
        if (servicesData?.data?.items) {
            const total = servicesData.data.items.reduce((sum, service) => sum + service.memory, 0);
            setTotalMemory(total);
        }
    }, [servicesData]);

    return (
        <CenterCard title={title} id={id}>
            <AsyncView atom={servicesData}>
                <CardValue Icon={LineChart} value={(totalMemory / (1024 * 1024)).toFixed(2)} />
            </AsyncView>
        </CenterCard>
    );
};


export const TotalCPUUsage = ({ title, id }) => {
    const [servicesData, setServicesData] = useRemoteStateList(undefined, fetch, ServiceModel.getNotificationsTopic(), ServiceModel, true);
    const [totalCPU, setTotalCPU] = useState(0);

    useEffect(() => {
        if (servicesData?.data?.items) {
            const total = servicesData.data.items.reduce((sum, service) => sum + service.cpu, 0);
            setTotalCPU(total);
        }
    }, [servicesData]);

    return (
        <CenterCard title={title} id={id}>
            <AsyncView atom={servicesData}>
                <CardValue Icon={Cpu} value={totalCPU.toFixed(2)} />
            </AsyncView>
        </CenterCard>
    );
};