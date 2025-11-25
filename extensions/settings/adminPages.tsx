import { SettingModel } from '.'
import { DataView } from 'protolib/components/DataView'
import { AdminPage } from 'protolib/components/AdminPage'
import { Key } from '@tamagui/lucide-icons';
import { usePrompt } from 'protolib/context/PromptAtom'
import { PaginatedData } from 'protolib/lib/SSR';
import { DataTable2 } from 'protolib/components/DataTable2'
import { SiteConfig } from '@my/config/dist/AppConfig'
import {
  TooltipGroup,
  XGroup,
  XStack,
  YStack,
  Paragraph,
  Text
} from '@my/ui'
import { ThemeToggle } from 'protolib/components/ThemeToggle'
import { ColorToggleButton } from 'protolib/components/ColorToggleButton'
import { Icon } from 'protolib/components/board/ActionCard'
import { SizableText } from 'protolib/components/datepickers/dateParts';

const sourceUrl = '/api/core/v1/settings'
const tooltipDelay = { open: 500, close: 150 }

const configPanels = [
  { name: 'Users', href: '/workspace/users', icon: "users", description: "Manage system users" },
  { name: 'Keys', href: '/workspace/keys', icon: "key", description: "Manage system keys" },
  { name: 'Events', href: '/workspace/events', icon: "activity", description: "View system events" },
  { name: 'Services', href: '/workspace/services', icon: "server", description: "View system services" },
  { name: 'Databases', href: '/workspace/databases', icon: "database", description: "Manage databases" },
  { name: 'Files', href: '/workspace/files?path=/', icon: "folder", description: "Manage system files" },
  { name: 'Settings', href: '/workspace/settings', icon: "cog", description: "Configure system settings" },
  { name: 'Themes', href: '/workspace/themes', icon: "palette", description: "Change or customize themes" }
]

export default {
  'settings': {
    component: ({ pageState, initialItems, pageSession, extraData }: any) => {
      usePrompt(() => `` + (
        initialItems?.isLoaded ? 'Currently the system returned the following information: ' + JSON.stringify(initialItems.data) : ''
      ))

      const settingsTintSwitcher = SiteConfig.ui?.tintSwitcher
      const settingsThemeSwitcher = SiteConfig.ui?.themeSwitcher
      const settingsTintSwitcherEnabled = settingsTintSwitcher === undefined ? true : settingsTintSwitcher
      const settingsThemeSwitcherEnabled = settingsTintSwitcher === undefined ? true : settingsThemeSwitcher

      return (<AdminPage title="Keys" pageSession={pageSession}>
        <DataView
          enableAddToInitialData
          disableViews={["grid"]}
          defaultView={'list'}
          sourceUrl={sourceUrl}
          initialItems={initialItems}
          numColumnsForm={1}
          name="settings"
          model={SettingModel}
          columns={DataTable2.columns(
            DataTable2.column("name", row => row.name, "name", undefined, true, '400px'),
            DataTable2.column("value", row => typeof row.value === "string" ? row.value : JSON.stringify(row.value), "value", undefined, true),
          )}
        />
      </AdminPage>)
    },
    getServerSideProps: PaginatedData(sourceUrl, ['admin'])
  },
  'config': {
    component: ({ pageState, initialItems, pageSession, extraData }: any) => {
      return (
        <AdminPage title="Config" pageSession={pageSession}>
          <XStack
            f={1}
            m="$6"
            marginTop="$8"
            flexWrap="wrap"
            gap="$4"          // separación horizontal
            rowGap="$4"       // separación vertical entre filas (explícita)
            justifyContent="flex-start"
            alignItems="flex-start"
            alignContent="flex-start" // evita el “estirado” entre filas
          >
            <Text paddingLeft="$4" width="100%" fontSize="$9" fontWeight="600" color="$color11">Config Panels</Text>
            {configPanels.map((panel, index) => (
              <a
                key={index}
                href={panel.href}
                // que el anchor no crezca ni rompa el layout
                style={{ textDecoration: 'none', display: 'inline-flex', flex: '0 0 auto' }}
              >
                <XStack
                  ai="center"
                  // jc="center"
                  br="$6"
                  width={500}
                  padding="$4"
                  backgroundColor="var(--bgPanel)"
                  // NO crecer:
                  f={0}
                  flexShrink={0}
                  // usa gap interno para icono/texto si quieres
                  gap="$4"
                  animation="quick"
                  hoverStyle={{
                    opacity: 0.9,
                    cursor: 'pointer',
                  }}
                >
                  <Icon
                    color="var(--color)"
                    name={panel.icon}
                    size={34}
                    style={{ opacity: 0.8 }}
                  />
                  <YStack>
                    <Text fontSize="$6" fontWeight="500">
                      {panel.name}
                    </Text>
                    <Text fontSize="$6" color="$color9">
                      {panel.description}
                    </Text>
                  </YStack>
                </XStack>
              </a>
            ))}
          </XStack>
        </AdminPage>
      )
    }
  }
}