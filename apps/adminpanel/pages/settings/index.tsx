import SettingsPage from '@extensions/settings/adminPages'
import Head from 'next/head'
import { SiteConfig } from 'app/conf'

export default function Page(props:any) {
  const projectName = SiteConfig.projectName

  return (
    <>
      <Head>
        <title>{projectName + " - Settings"}</title>
      </Head>
      <SettingsPage.settings.component {...props} />
    </>
  )
}
