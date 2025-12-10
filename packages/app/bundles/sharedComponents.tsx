import { TransferComponent } from 'protolib/lib/transferComponent';
import { UsersView } from '@extensions/users/adminPages';
import { ServicesView } from '@extensions/services/adminPages';
import { PieChart } from 'protolib/components/PieChart';
import { BarChart } from 'protolib/components/BarChart';
import { LineChart } from 'protolib/components/LineChart';
import { AreaChart } from 'protolib/components/AreaChart';
import { RadarChart } from 'protolib/components/RadarChart';
import { Markdown } from 'protolib/components/Markdown';
import { Html } from 'protolib/components/Html';
import { RadialBarChart } from 'protolib/components/RadialBartChart';
import { KeySetter } from 'protolib/components/KeySetter';
import { KeyGate } from 'protolib/components/KeyGate';
import { InteractiveIcon } from 'protolib/components/InteractiveIcon';
import CanvasDraw from "react-canvas-draw"
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
import { API, ProtoModel } from 'protobase';
import { FileBrowser } from 'protolib/adminpanel/next/components/FileBrowser';
import { Button, Spinner, XStack, YStack, Text, View, Input, Paragraph } from '@my/ui'
import { ViewList } from 'protolib/components/ViewList';
import { ViewObject } from 'protolib/components/ViewObject';
import { JSONView } from 'protolib/components/JSONView';
import { ProtoThemeProvider } from 'protolib/components/ProtoThemeProvider';
import { CameraPreview } from 'protolib/components/vision/CameraPreview';
import { CameraCard } from 'protolib/components/vision/CameraCard';
import { ActionCard, ParamsForm, Icon } from 'protolib/components/board/ActionCard';
import { CardValue } from 'protolib/components/board/CardValue';
import { Provider } from 'app/provider'
import { Tinted } from 'protolib/components/Tinted';
import { ObjectViewLoader } from 'protolib/components/ObjectViewLoader';
import { MqttWrapper } from 'protolib/components/MqttWrapper';
import { BasicPlaceHolder } from 'protolib/visualui/visualuiWrapper';
import { StorageView } from 'protolib/components/StorageView';
import { useEventEffect } from '@extensions/events/hooks';
import { useKeyState } from 'protolib/components/KeySetter';
import { InteractiveGrid } from 'protolib/components/InteractiveGrid';
import { Subsystems } from 'protodevice/src/Subsystem';


const layoutMetadata = {
    visualui: {
        palette: "basic",
        craft: {
            custom: {
                icon: "layout-grid",
            },
        },
        visualUIOnlyFallbackProps: { children: <BasicPlaceHolder /> }
    }
}

const textMetadata = {
    visualui: {
        palette: "basic",
        craft: {
            custom: {
                icon: "type",
            },
            props: { children: "hello world!" },
        },
        editableText: true
    }
}

export const transferExtensionComponents = () => {
    TransferComponent(InteractiveGrid, 'InteractiveGrid');
    TransferComponent(XStack, 'XStack', layoutMetadata);
    TransferComponent(YStack, 'YStack', layoutMetadata);
    TransferComponent(Paragraph, 'Paragraph');
    TransferComponent(UsersView, 'UsersView');
    TransferComponent(ServicesView, 'ServicesView');
    TransferComponent(PieChart, 'PieChart');
    TransferComponent(BarChart, 'BarChart');
    TransferComponent(LineChart, 'LineChart');
    TransferComponent(AreaChart, 'AreaChart');
    TransferComponent(RadarChart, 'RadarChart');
    TransferComponent(RadialBarChart, 'RadialBarChart');
    TransferComponent(KeySetter, 'KeySetter');
    TransferComponent(KeyGate, 'KeyGate');
    TransferComponent(InteractiveIcon, 'InteractiveIcon');
    TransferComponent(CanvasDraw, 'CanvasDraw');
    TransferComponent(Markdown, 'Markdown');
    TransferComponent(Html, 'Html');
    TransferComponent(ReactMarkdown, 'ReactMarkdown');
    TransferComponent(remarkGfm, 'remarkGfm')
    TransferComponent(API, 'API');
    TransferComponent(FileBrowser, 'FileBrowser');
    TransferComponent(Spinner, 'Spinner');
    TransferComponent(ViewList, 'ViewList');
    TransferComponent(ViewObject, 'ViewObject');
    TransferComponent(JSONView, 'JSONView');
    TransferComponent(ProtoThemeProvider, 'ProtoThemeProvider');
    TransferComponent(CameraPreview, 'CameraPreview');
    TransferComponent(CameraCard, 'CameraCard');
    TransferComponent(ActionCard, 'ActionCard');
    TransferComponent(CardValue, 'CardValue');
    TransferComponent(ParamsForm, 'ParamsForm');
    TransferComponent(Icon, 'Icon', {
        visualui: {
            palette: "basic",
            craft: {
                custom: {
                    icon: "squirrel",
                },
                props: { name: "squirrel", size: 24, color: "var(--color8)" },
            },
        }
    });
    TransferComponent(Button, 'Button', {
        visualui: {
            palette: "basic",
            craft: {
                custom: {
                    icon: "square-mouse-pointer",
                },
                props: { children: "press me" },
            },
        }
    });
    TransferComponent(Text, 'Text', textMetadata);
    TransferComponent(Input, 'Input');
    TransferComponent(View, 'View', layoutMetadata);
    TransferComponent(Provider, 'Provider');
    TransferComponent(Tinted, 'Tinted');
    TransferComponent(StorageView, 'StorageView');
    TransferComponent(ObjectViewLoader, 'ObjectViewLoader');
    TransferComponent(ProtoModel, 'ProtoModel');
    TransferComponent(useEventEffect, 'useEventEffect');
    TransferComponent(MqttWrapper, 'MqttWrapper');
    TransferComponent(useKeyState, 'useKeyState');
    TransferComponent(Subsystems, 'Subsystems');
}


