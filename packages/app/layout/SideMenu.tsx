import { SideMenu as ProtoSideMenu } from 'protolib/components/layout/SideMenu'
import { Image, useThemeName, YStack } from '@my/ui';

export const SideMenu = (props) => {
    const themeName = useThemeName()

    return <ProtoSideMenu
        logo={<YStack height={30} enterStyle={{ opacity: 0, rotate: '-3deg' }} top={0} animation={"bouncy" as any}>
            <Image
                key={themeName}
                style={{ filter: themeName?.startsWith("dark") ? "invert(70%) brightness(10)" : "invert(5%)" }}
                src={"/public/vento-logo.svg"}
                alt="Logo"
                width={90}
                height={30}
                resizeMode='contain'
            />
        </YStack>}
        collapsedLogo={<Image
            key={themeName}
            style={{ filter: themeName?.startsWith("dark") ? "invert(70%) brightness(10)" : "invert(5%)" }}
            src={"/public/vento-square.svg"}
            alt="Logo"
            width={22}
            height={30}
            resizeMode='contain'
        />
        }
        {...props}
    />
}
