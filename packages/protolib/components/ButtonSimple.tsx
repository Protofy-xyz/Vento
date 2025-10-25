import { ButtonProps, Button, Text } from "@my/ui"
import React from 'react'

export const ButtonSimple = React.forwardRef(({textColor = undefined, fontFamily = undefined, ...props}: ButtonProps & any, ref: any) => (
    <Button
        //@ts-ignore
        ref={ref}
        borderRadius="$10"
        size="$3"
        elevate
        space="$3"
        {...props}
    >
        <Text color={textColor} fontFamily={fontFamily} display="flex" alignItems="center">
            {props.children}
        </Text>
    </Button>
))

export default ButtonSimple