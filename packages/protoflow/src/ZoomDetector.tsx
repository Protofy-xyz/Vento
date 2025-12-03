import React from 'react';
import { useStore } from '@xyflow/react';
import { useZoomStore } from './store/ZoomStore';

export default ({zoom}) => {
    try {
        const setZoom = useZoomStore(state => state.setZoom);
        const zoomLevel = useStore((s) => s.transform[2]);
        //uncomment this line to toggle zoom transitions
        //setZoom(zoomLevel)
    } catch(e) {
        console.error(e);
    }

    return <></>
}