import { StackProps, YStack } from "@my/ui";
import React from "react"

export const ElevatedArea = React.forwardRef((props: StackProps & { br?: any }, ref: any) => (
    <YStack
        ref={ref}
        //@ts-ignore
        pos="relative"
        elevation="$4"
        py="$4"
        pt="$6"
        pb="$10"
        zIndex={1}
        br={props.br ?? undefined}
        {...props}
    >
        {/*@ts-ignore*/}
        <YStack fullscreen bc="$color3" zi={-1} o={0.25} btw={1} btc="$borderColor" br={props.br} />
        {props.children}
    </YStack>
))

export default ElevatedArea