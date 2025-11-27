import { Footer } from './Footer'
import { HeaderContents } from './HeaderContents'
import { DefaultLayout as ProtoDefaultLayout } from 'protolib/components/layout/DefaultLayout'
import { AppBar } from 'protolib/components/AppBar'
import React from 'react'
import { StackProps, Image, useThemeName } from '@my/ui'

export const DefaultLayout = React.forwardRef((props: {
  sideMenu?: React.ReactNode | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  headerTitle?: string;
  seoProps?: any;
  title?: string;
  description?: string;
  openGraph?: any;
  tintSwitcher?: boolean;
  themeSwitcher?: boolean;
} & StackProps, ref: any) => {

  const themeName = useThemeName()

  return <ProtoDefaultLayout
    ref={ref}
    sideMenu={null}
    footer={<Footer />}
    header={<AppBar>
      <HeaderContents
        headerTitle={props.headerTitle}
        logo={<Image
          key={themeName}
          style={{ filter: themeName?.startsWith("dark") ? "invert(70%) brightness(10)" : "invert(5%)" }}
          src={"/public/vento-logo.svg"}
          alt="Logo"
          width={180}
          height={30}
          resizeMode='contain'
        />}
      />
    </AppBar>}
    title="Vento"
    description="Vento: natural language machine automation platform"
    openGraph={{
      type: 'website',
      locale: 'en_US',
      url: 'https://protofy.xyz',
      siteName: 'Protofy',
      images: [
        {
          url: 'https://protofy.xyz/social.png',
        },
      ],
    }} {...props}>{props.children}</ProtoDefaultLayout>
}
)