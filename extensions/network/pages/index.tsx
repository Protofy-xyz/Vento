import React, { useMemo, useCallback } from 'react'
import { BoardModel } from '../../boards/boardsSchemas'
import { API } from 'protobase'
import { DataTable2 } from "protolib/components/DataTable2"
import { DataView, DataViewActionButton } from "protolib/components/DataView"
import { AdminPage } from "protolib/components/AdminPage"
import { PaginatedData, SSR } from "protolib/lib/SSR"
import { withSession } from "protolib/lib/Session"
import { useRouter } from 'solito/navigation';
import { createParam } from 'solito'
import { AsyncView } from 'protolib/components/AsyncView'
import { YStack, XStack, Spacer, ScrollView, Text, Paragraph, Button } from "@my/ui";
import { AlertDialog } from 'protolib/components/AlertDialog'
import { useState } from 'react'
import { Slides } from 'protolib/components/Slides';
import { TemplateCard } from '../../apis/TemplateCard';
import { Eye, EyeOff, Plus, Bot, Sparkles, Network, PlayCircle } from '@tamagui/lucide-icons'
import { usePageParams } from 'protolib/next'
import { Tinted } from 'protolib/components/Tinted'
import { BoardView } from '@extensions/boards/pages/view'
import { networkOptions, NetworkOption } from '../options'
import { shouldShowInArea } from 'protolib/helpers/Visibility'
import { NetworkTopologyView } from '../components/NetworkTopologyView'
import { NetworkCard } from '../components/NetworkCard'
import { TutorialVideoDialog } from 'protolib/components/TutorialVideoDialog'

const { useParams } = createParam()

const sourceUrl = '/api/core/v1/boards'

const SelectGrid = ({ children }) => {
  return <XStack jc="flex-start" ai="flex-start" gap={25} flexWrap='wrap' width="100%" maxWidth={760} mx="auto">
    {children}
  </XStack>
}

// Empty state component when there are no agents
const EmptyAgentsState = ({ onCreateClick }: { onCreateClick: () => void }) => {
  return (
    <YStack f={1} ai="center" jc="center" py="$10" gap="$6" mt="$8">
      {/* Decorative icon with effect */}
      <YStack position="relative" ai="center" jc="center">
        <YStack
          position="absolute"
          width={120}
          height={120}
          br={60}
          opacity={0.2}
          bg="$color9"
          // @ts-ignore
          style={{ filter: 'blur(40px)' }}
        />
        <Tinted>
          <Bot size={72} color="$color9" strokeWidth={1.2} />
        </Tinted>
      </YStack>

      {/* Main text */}
      <YStack ai="center" gap="$2" maw={400}>
        <Text fontSize="$8" fontWeight="700" color="$color12" ta="center" fontFamily="$heading">
          No agents yet
        </Text>
        <Paragraph size="$4" color="$color10" ta="center" lh="$5">
          Create your first AI agent to automate tasks, connect devices, and build intelligent workflows.
        </Paragraph>
      </YStack>

      {/* Large create button */}
      <Tinted>
        <Button size="$5" icon={Plus} onPress={onCreateClick}>
          Create your first agent
        </Button>
      </Tinted>

      {/* Hint subtle */}
      <XStack ai="center" gap="$2" opacity={0.5}>
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


export default {
  boards: {
    component: ({ workspace, pageState, initialItems, itemData, pageSession, extraData }: any) => {
      const router = useRouter()
      const { push, query} = usePageParams({})
      const [addOpen, setAddOpen] = React.useState(false)
      const [tutorialOpen, setTutorialOpen] = useState(false)
      const [selectedOption, setSelectedOption] = useState<NetworkOption | null>(networkOptions[0] || null)
      const [step, setStep] = useState<'select' | 'configure'>('select')

      const handleCreated = useCallback((data?: any) => {
        setAddOpen(false)
        setStep('select')
        // Navigation is handled by each option's Component
      }, [])

      const handleDialogClose = useCallback((open: boolean) => {
        setAddOpen(open)
        if (!open) {
          setStep('select')
        }
      }, [])

      // Memoize the node click handler
      const handleNodeClick = useCallback((nodeData: any) => {
        if (nodeData?.originalData?.name) {
          router.push(`/boards/view?board=${nodeData.originalData.name}`)
        }
      }, [router])

      // Handler for Add node click
      const handleAddClick = useCallback(() => {
        setAddOpen(true)
      }, [])

      // Memoize extraViews to prevent re-renders of NetworkTopologyView
      const extraViews = useMemo(() => [{
        name: 'topology',
        icon: Network,
        component: () => <NetworkTopologyView 
          showAll={query.all === 'true'}
          onNodeClick={handleNodeClick}
          onAddClick={handleAddClick}
        />,
      }], [query.all, handleNodeClick, handleAddClick])

      // Memoize extraActions
      const extraActions = useMemo(() => [
        <Tinted key="watch-tutorial">
          <DataViewActionButton
            id="admin-dataview-tutorial-btn"
            icon={PlayCircle}
            description="Watch tutorial"
            onPress={() => setTutorialOpen(true)}
          />
        </Tinted>,
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
      ], [query.all, push])

      // Memoize dataTableGridProps
      const dataTableGridProps = useMemo(() => ({
        emptyMessage: <EmptyAgentsState onCreateClick={() => setAddOpen(true)} />,
        itemsTransform: (items: any[]) => {
          const list = Array.isArray(items) ? [...items] : [];
          if (query.all !== 'true') {
            return list.filter((item) => shouldShowInArea(item, 'agents'));
          }
          return list;
        },
        getCard: (element: any, width: number) => (
          <NetworkCard
            board={element}
            platform={element.platform || 'virtual'}
            mode="card"
            width={width}
            onPress={() => router.push(`/boards/view?board=${element.name}`)}
            onDelete={async () => {
              await API.get(`/api/core/v1/boards/${element.name}/delete`);
            }}
          />
        ),
      }), [query.all, router])

      return (<AdminPage title="Network" workspace={workspace} pageSession={pageSession}>
        
        <TutorialVideoDialog
          open={tutorialOpen}
          onClose={() => setTutorialOpen(false)}
        />

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
              {/* Keep both components mounted but hidden to avoid re-render of underlying graph */}
              <YStack display={step === 'select' ? 'flex' : 'none'}>
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
              </YStack>
              <YStack display={step === 'configure' ? 'flex' : 'none'}>
                {selectedOption && <selectedOption.Component onCreated={handleCreated} onBack={() => setStep('select')} />}
              </YStack>
            </XStack>
          </YStack>
        </AlertDialog>
          <DataView
            entityName={"network"}
            itemData={itemData}
            sourceUrl={sourceUrl}
            sourceUrlParams={query}
            hideDeleteAll={true}
            extraViews={extraViews}
            extraActions={extraActions}
            extraFilters={[{ queryParam: "all" }]}
            
            initialItems={initialItems}
            numColumnsForm={1}
            onAdd={(data) => { router.push(`/boards/view?board=${data.name}`); return data }}
            name="Network Element"
            disableViews={['raw', 'list']}
            onEdit={data => { console.log("DATA (onEdit): ", data); return data }}
            onSelectItem={(item) => router.push(`/boards/view?board=${item.data.name}`)}
            columns={DataTable2.columns(
              DataTable2.column("name", row => row.name, "name")
            )}
            onAddButton={() => setAddOpen(true)}
            model={BoardModel}
            pageState={pageState}
            dataTableGridProps={dataTableGridProps}
            defaultView={"topology"}
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
