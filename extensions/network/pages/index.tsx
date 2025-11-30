import React from 'react'
import { BoardModel } from '../../boards/boardsSchemas'
import { API } from 'protobase'
import { DataTable2 } from "protolib/components/DataTable2"
import { DataView } from "protolib/components/DataView"
import { AdminPage } from "protolib/components/AdminPage"
import { PaginatedData, SSR } from "protolib/lib/SSR"
import { withSession } from "protolib/lib/Session"
import { useRouter } from 'solito/navigation';
import BoardPreview from 'protolib/components/board/BoardPreview'
import { createParam } from 'solito'
import { AsyncView } from 'protolib/components/AsyncView'
import { YStack, Text, XStack, Spacer, ScrollView, Input } from "@my/ui";
import { AlertDialog } from 'protolib/components/AlertDialog'
import { useEffect, useState } from 'react'
import { Slides } from 'protolib/components/Slides';
import { TemplateCard } from '../../apis/TemplateCard';
import { usePageParams } from 'protolib/next'
import { Board } from '@extensions/boards/pages/view'
import { BoardView } from '@extensions/boards/pages/view'

const { useParams } = createParam()

const sourceUrl = '/api/core/v1/boards'

// ========== TOGGLE DE VISTA ==========
// Cambiar a true para usar la vista embebida (NetworkPreview)
// Cambiar a false para usar la vista de cards (BoardPreview)
const USE_EMBEDDED_VIEW = false
// =====================================

const SelectGrid = ({ children }) => {
  return <XStack jc="center" ai="center" gap={25} flexWrap='wrap'>
    {children}
  </XStack>
}

const FirstSlide = ({ selected, setSelected }) => {
  const [boardTemplates, setBoardTemplates] = useState([]);
  const reloadBoardTemplates = async () => {
    const templates = await API.get(`/api/core/v2/templates/boards`);
    let templatesData = templates.data || [];
    templatesData = templatesData.map((tpl) => {
      return tpl
    })
    setBoardTemplates(templatesData);
  };

  useEffect(() => {
    reloadBoardTemplates()
  }, []);

  //template with id empty should be the first
  return <YStack>
    <ScrollView mah={"500px"}>
      <SelectGrid>
        {Object.entries(boardTemplates).map(([templateId, template]) => (
          <TemplateCard
            key={templateId}
            template={template}
            isSelected={selected?.id === template?.id}
            onPress={() => setSelected(template)}
          />
        ))}
      </SelectGrid>
    </ScrollView>
    <Spacer marginBottom="$8" />
  </YStack>
}

const isNameValid = (text) => {
  return text == ''? false:/^[a-z_]*$/.test(text)
}

const SecondSlide = ({ selected, setName, errorMessage=''}) => {
  const [error, setError] = useState('')
  useEffect(() => setError(errorMessage), [errorMessage])
  const handleChange = (text: string) => {
    if (!isNameValid(text)) {
      setError('Name is required and must use only lowercase letters and underscores')
    } else {
      setError('')
    }
    setName(text)
  }

  return <YStack minHeight={"200px"} jc="center" ai="center">
    <YStack width="400px" gap="$2">
      <Input f={1} value={selected?.name} onChangeText={handleChange} placeholder="Enter board name" />
      <Text ml="$2" h={"$1"} fos="$2" color="$red8">{error}</Text>
    </YStack>
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

      const defaultData = { template: { id: 'ai agent' }, name: '' }
      const [data, setData] = useState(defaultData)

      return (<AdminPage title="Network" workspace={workspace} pageSession={pageSession}>

        <AlertDialog
          p={"$2"}
          pt="$5"
          pl="$5"
          setOpen={setAddOpen}
          open={addOpen}
          hideAccept={true}
          description={""}
        >
          <YStack f={1} jc="center" ai="center">
            <XStack mr="$5">
              <Slides
                lastButtonCaption="Create"
                id='boards'
                onFinish={async () => {
                  console.log('val: ', data)
                  const name = data.name
                  if (!isNameValid(name)) return
                  const template = data.template
                  await API.post(`/api/core/v1/import/board`, { name, template })
                  router.push(`/boards/view?board=${name}`)
                }}
                slides={[
                  {
                    name: "Create new Board",
                    title: "Select your Template",
                    component: <FirstSlide selected={data?.template} setSelected={(template) => setData({ ...data, template })} />
                  },
                  {
                    name: "Configure your Board",
                    title: "Board Name",
                    component: <SecondSlide selected={data} setName={(name) => setData({ ...data, name })} />
                  }
                ]
                }></Slides>
            </XStack>
          </YStack>
        </AlertDialog>

        <DataView
          entityName={"network"}
          itemData={itemData}
          sourceUrl={sourceUrl}
          sourceUrlParams={query}
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