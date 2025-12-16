import SettingsPage from '@extensions/settings/adminPages'
import Head from 'next/head'
import { SiteConfig } from 'app/conf'

const RawSettingsConfig = SettingsPage['settings/raw']

export default function Page(props: any) {
  const projectName = SiteConfig.projectName
  const RawSettingsComponent = RawSettingsConfig.component

  return (
    <>
      <Head>
        <title>{projectName + " - Raw Settings"}</title>
      </Head>
      <RawSettingsComponent {...props} />
    </>
  )
}
