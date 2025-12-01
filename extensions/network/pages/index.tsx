import React from 'react'
import { BoardModel } from '../../boards/boardsSchemas'
import { API } from 'protobase'
import { DataTable2 } from "protolib/components/DataTable2"
import { DataView, DataViewActionButton } from "protolib/components/DataView"
import { AdminPage } from "protolib/components/AdminPage"
import { PaginatedData, SSR } from "protolib/lib/SSR"
import { withSession } from "protolib/lib/Session"
import { useRouter } from 'solito/navigation';
import BoardPreview from 'protolib/components/board/BoardPreview'
import { createParam } from 'solito'
import { AsyncView } from 'protolib/components/AsyncView'
import { YStack, XStack, Spacer, ScrollView, Text, Paragraph } from "@my/ui";
import { AlertDialog } from 'protolib/components/AlertDialog'
import { useState } from 'react'
import { Slides } from 'protolib/components/Slides';
import { TemplateCard } from '../../apis/TemplateCard';
import { Eye, EyeOff, Plus, Bot, Sparkles } from '@tamagui/lucide-icons'
import { usePageParams } from 'protolib/next'
import { Tinted } from 'protolib/components/Tinted'
import { Board } from '@extensions/boards/pages/view'
import { BoardView } from '@extensions/boards/pages/view'
import { networkOptions, NetworkOption } from '../options'
import { shouldShowInArea } from 'protolib/helpers/Visibility'

const { useParams } = createParam()

const sourceUrl = '/api/core/v1/boards'

// ========== TOGGLE DE VISTA ==========
// Cambiar a true para usar la vista embebida (NetworkPreview)
// Cambiar a false para usar la vista de cards (BoardPreview)
const USE_EMBEDDED_VIEW = false
// =====================================

const SelectGrid = ({ children }) => {
  return <XStack jc="flex-start" ai="flex-start" gap={25} flexWrap='wrap' width="100%" maxWidth={760} mx="auto">
    {children}
  </XStack>
}

// Empty state component when there are no agents
const EmptyAgentsState = ({ onCreateClick }: { onCreateClick: () => void }) => {
  return (
    <YStack 
      flex={1} 
      alignItems="center" 
      justifyContent="center" 
      paddingVertical="$10"
      gap="$6"
      marginTop="$8"
    >
      {/* Decorative icon with effect */}
      <YStack 
        position="relative"
        alignItems="center" 
        justifyContent="center"
      >
        <YStack
          position="absolute"
          width={120}
          height={120}
          borderRadius={60}
          opacity={0.2}
          backgroundColor="$color9"
          // @ts-ignore
          style={{
            filter: 'blur(40px)',
          }}
        />
        <Tinted>
          <Bot size={72} color="$color9" strokeWidth={1.2} />
        </Tinted>
      </YStack>

      {/* Main text */}
      <YStack alignItems="center" gap="$2" maxWidth={400}>
        <Text 
          fontSize="$8" 
          fontWeight="700" 
          color="$color12"
          textAlign="center"
          fontFamily="$heading"
        >
          No agents yet
        </Text>
        <Paragraph 
          size="$4" 
          color="$color10" 
          textAlign="center"
          lineHeight="$5"
        >
          Create your first AI agent to automate tasks, connect devices, and build intelligent workflows.
        </Paragraph>
      </YStack>

      {/* Large create button */}
      <Tinted>
        <YStack
          // @ts-ignore
          tag="button"
          onPress={onCreateClick}
          backgroundColor="$color9"
          paddingHorizontal="$6"
          paddingVertical="$4"
          borderRadius="$5"
          cursor="pointer"
          hoverStyle={{
            backgroundColor: '$color10',
            scale: 1.02,
          }}
          pressStyle={{
            backgroundColor: '$color8',
            scale: 0.98,
          }}
          animation="quick"
          elevation="$3"
          gap="$2"
          alignItems="center"
          flexDirection="row"
        >
          <Plus size={24} color="white" strokeWidth={2.5} />
          <Text 
            fontSize="$5" 
            fontWeight="600" 
            color="white"
          >
            Create your first agent
          </Text>
        </YStack>
      </Tinted>

      {/* Hint subtle */}
      <XStack alignItems="center" gap="$2" opacity={0.5}>
        <Sparkles size={14} color="$color9" />
        <Text fontSize="$2" color="$color9">
          Agents can control devices, process data, and respond to events
        </Text>
      </XStack>
    </YStack>
  )
}

const CategorySlide = ({ selected, setSelected }: { selected: NetworkOption | null, setSelected: (option: NetworkOption) => void }) => {
  return <YStack>
    <ScrollView mah={"500px"}>
      <SelectGrid>
        {networkOptions.map((option) => (
          <TemplateCard
            key={option.id}
            template={option}
            isSelected={selected?.id === option.id}
            onPress={() => setSelected(option)}
          />
        ))}
      </SelectGrid>
    </ScrollView>
    <Spacer marginBottom="$8" />
  </YStack>
}

// Vista alternativa: NetworkPreview - Muestra el board embebido directamente en la card
const NetworkPreview = ({ board, width, onDelete }: any) => {
    return (
        <YStack
            cursor="pointer"
            bg="$bgPanel"
            elevation={4}
            br="$4"
            width={'100%'}
            f={1}
            display="flex"
            maxWidth={width ?? 474}
            gap="$4"
            height="500px"
        >
            <Board forceViewMode={'ui'} key={board?.name} board={board} icons={[]} />
        </YStack>
    )
}

export default {
  boards: {
    component: ({ workspace, pageState, initialItems, itemData, pageSession, extraData }: any) => {
      const router = useRouter()
      const { push, query} = usePageParams({})
      const [addOpen, setAddOpen] = React.useState(false)
      const [selectedOption, setSelectedOption] = useState<NetworkOption | null>(networkOptions[0] || null)
      const [step, setStep] = useState<'select' | 'configure'>('select')

      const handleCreated = (data?: any) => {
        setAddOpen(false)
        setStep('select')
        // Navigation is handled by each option's Component
      }

      const handleDialogClose = (open: boolean) => {
        setAddOpen(open)
        if (!open) {
          setStep('select')
        }
      }

      return (<AdminPage title="Network" workspace={workspace} pageSession={pageSession}>

        <AlertDialog
          p={"$2"}
          pt="$5"
          pl="$5"
          setOpen={handleDialogClose}
          open={addOpen}
          hideAccept={true}
          description={""}
        >
          <YStack f={1} jc="center" ai="center">
            <XStack mr="$5">
              {step === 'select' ? (
                <Slides
                  lastButtonCaption="Next"
                  id='network-categories'
                  onFinish={() => {
                    setStep('configure')
                  }}
                  slides={[
                    {
                      name: "Add Network Element",
                      title: "",
                      component: <CategorySlide selected={selectedOption} setSelected={setSelectedOption} />
                    }
                  ]}
                />
              ) : (
                selectedOption && <selectedOption.Component onCreated={handleCreated} onBack={() => setStep('select')} />
              )}
            </XStack>
          </YStack>
        </AlertDialog>

        <DataView
          entityName={"network"}
          itemData={itemData}
          sourceUrl={sourceUrl}
          sourceUrlParams={query}
          hideDeleteAll={true}
          extraActions={[
            <Tinted key="toggle-visibility-scope">
              <DataViewActionButton
                id="admin-dataview-add-btn"
                icon={query.all === 'true' ? EyeOff : Eye}
                description={
                  query.all === 'true'
                    ? 'Show only boards visible in this view'
                    : 'Show boards from all views'
                }
                onPress={() => {
                  push('all', query.all === 'true' ? 'false' : 'true')
                }}
              />
            </Tinted>
          ]}
          extraFilters={[{ queryParam: "all" }]}
          initialItems={initialItems}
          numColumnsForm={1}
          onAdd={(data) => { router.push(`/boards/view?board=${data.name}`); return data }}
          name="Network Element"
          disableViews={['raw']}
          onEdit={data => { console.log("DATA (onEdit): ", data); return data }}
          onSelectItem={(item) => router.push(`/boards/view?board=${item.data.name}`)}
          columns={DataTable2.columns(
            DataTable2.column("name", row => row.name, "name")
          )}
          onAddButton={() => setAddOpen(true)}
          model={BoardModel}
          pageState={pageState}
          dataTableGridProps={{
            emptyMessage: <EmptyAgentsState onCreateClick={() => setAddOpen(true)} />,
            itemsTransform: (items) => {
              const list = Array.isArray(items) ? [...items] : [];
              if (query.all !== 'true') {
                return list.filter((item) => shouldShowInArea(item, 'agents'));
              }
              return list;
            },
            getCard: (element, width) => USE_EMBEDDED_VIEW 
              ? <NetworkPreview 
                  board={element} 
                  width={width} 
                  onDelete={async () => {
                    await API.get(`/api/core/v1/boards/${element.name}/delete`);
                  }}
                />
              : <BoardPreview
                  onDelete={async () => {
                    await API.get(`/api/core/v1/boards/${element.name}/delete`);
                  }}
                  element={element}
                  width={width}
                />,
          }}
          defaultView={"grid"}
        />
      </AdminPage>)
    },
    getServerSideProps: PaginatedData(sourceUrl, ['admin'])
  },
  // Vista detallada del board (igual que en agents)
  view: {
    component: (props: any) => {
      const { params } = useParams()

      return <AsyncView ready={params.board ? true : false}>
        <BoardView key={params.board} {...props} board={undefined} />
      </AsyncView>
    },
    getServerSideProps: SSR(async (context) => withSession(context, ['admin'], async (session) => {
      return {
        board: await API.get(`/api/core/v1/boards/${context.params.board}/?token=${session?.token}`),
        icons: (await API.get(`/api/core/v1/icons?token=${session?.token}`))?.data?.icons ?? []
      }
    }))
  }
}
