import React from 'react'
import { BoardModel } from '../boardsSchemas'
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
import { BoardView } from './view'
import { YStack, Text, XStack, Spacer, ScrollView, Input } from "@my/ui";
import { AlertDialog } from 'protolib/components/AlertDialog'
import { useEffect, useState } from 'react'
import { Slides } from 'protolib/components/Slides';
import { TemplateCard } from '../../apis/TemplateCard';
import { CardView } from './card'
import { Eye, EyeOff } from '@tamagui/lucide-icons'
import { usePageParams } from 'protolib/next'
import { Tinted } from 'protolib/components/Tinted'
import { shouldShowInArea } from 'protolib/helpers/Visibility';

const { useParams } = createParam()

const sourceUrl = '/api/core/v1/boards'

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
  return text == '' ? false : /^[a-z_]*$/.test(text)
}

const SecondSlide = ({ selected, setName, errorMessage = '' }) => {
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
      <Input f={1} value={selected?.name} onChangeText={handleChange} placeholder="Enter agent name" />
      <Text ml="$2" h={"$1"} fos="$2" color="$red8">{error}</Text>
    </YStack>
  </YStack>
}

export default {
  boards: {
    component: ({ workspace, pageState, initialItems, itemData, pageSession, extraData }: any) => {
      const router = useRouter()
      const { push, query } = usePageParams({})
      const [addOpen, setAddOpen] = React.useState(false)

      const defaultData = { template: { id: 'ai agent' }, name: '' }
      const [data, setData] = useState(defaultData)

      return (<AdminPage title="Boards" workspace={workspace} pageSession={pageSession}>

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
                    name: "Create new Agent",
                    title: "Select your Template",
                    component: <FirstSlide selected={data?.template} setSelected={(template) => setData({ ...data, template })} />
                  },
                  {
                    name: "Configure your Agent",
                    title: "Agent Name",
                    component: <SecondSlide selected={data} setName={(name) => setData({ ...data, name })} />
                  }
                ]
                }></Slides>
            </XStack>
          </YStack>
        </AlertDialog>

        <DataView
          entityName={"agents"}
          itemData={itemData}
          sourceUrl={sourceUrl}
          sourceUrlParams={query}
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
          name="Agent"
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

            itemsTransform: (items) => {
              const list = Array.isArray(items) ? [...items] : [];
              if (query.all !== 'true') {
                return list.filter((item) => shouldShowInArea(item, 'agents'));
              }
              return list;
            },

            getCard: (element, width) => (
              <BoardPreview
                onDelete={async () => {
                  await API.get(`${sourceUrl}/${element.name}/delete`);
                }}
                element={element}
                width={width}
              />
            ),
          }}
          defaultView={"grid"}
        />

      </AdminPage>)
    },
    getServerSideProps: PaginatedData(sourceUrl, ['admin'])
  },
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
  },
  card: {
    component: ({ board, card, mode }) => {
      return <CardView board={board} card={card} mode={mode} />
    }
  }
}
