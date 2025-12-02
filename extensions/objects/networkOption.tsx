import React, { useState } from 'react'
import { API } from 'protobase'
import { YStack, XStack, ScrollView, useToastController, Button, Text, Stack, Input } from "@my/ui"
import { ObjectModel } from './objectsSchemas'
import { Tinted } from 'protolib/components/Tinted'
import { useRouter } from 'solito/navigation'
import type { NetworkOption } from '../network/options'
import { KeysEditor } from './components/KeysEditor'

const sourceUrl = '/api/core/v1/objects'

const isNameValid = (text: string) => {
    return text !== '' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text)
}

const ConfigureSlide = ({ 
    data, 
    setData, 
    keys,
    setKeys,
    errorMessage = ''
}: { 
    data: any
    setData: (data: any) => void
    keys: any
    setKeys: (keys: any) => void
    errorMessage: string
}) => {
    const [nameError, setNameError] = useState('')

    const handleNameChange = (text: string) => {
        if (!isNameValid(text) && text !== '') {
            setNameError('Name must start with a letter and contain only letters, numbers or underscores')
        } else {
            setNameError('')
        }
        setData({ ...data, name: text })
    }

    return (
        <ScrollView maxHeight={"400px"}>
            <YStack gap="$4" padding="$3" paddingBottom="$4">
                {/* Object Name */}
                <YStack gap="$2">
                    <Text fontSize="$4" fontWeight="600" color="$gray11">Object Name</Text>
                    <Input 
                        value={data?.name || ''} 
                        onChangeText={handleNameChange} 
                        placeholder="MyObject" 
                        size="$4"
                    />
                    <Text height="$1" fontSize="$2" color="$red8">{nameError || errorMessage}</Text>
                </YStack>

                {/* Keys editor */}
                <YStack gap="$3">
                    <Text fontSize="$4" fontWeight="600" color="$gray11">Fields</Text>
                    <KeysEditor
                        path={['keys']}
                        value={keys}
                        setValue={setKeys}
                        mode="add"
                        formData={{ ...data, keys }}
                    />
                </YStack>
            </YStack>
        </ScrollView>
    )
}

const ObjectsWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const router = useRouter()
    const [data, setData] = useState({ name: '' })
    const [keys, setKeys] = useState<any>({
        name: {
            type: 'string',
            modifiers: [{ name: 'id' }]
        }
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleBack = () => {
        if (onBack) {
            onBack()
        }
    }

    const handleCreate = async () => {
        // Validate name
        if (!isNameValid(data.name)) {
            setError('Object name is required and must start with a letter')
            return
        }

        if (!keys || Object.keys(keys).length === 0) {
            setError('Add at least one field to create the object')
            return
        }

        const invalidFields = Object.keys(keys || {}).filter(k => !isNameValid(k))
        if (invalidFields.length > 0) {
            setError('All field names must be valid (start with letter, only letters/numbers/underscores)')
            return
        }

        setLoading(true)
        setError('')

        try {
            const objectData = {
                name: data.name,
                keys,
                api: true, // Enable API by default
                databaseType: 'Local Storage' // Use local storage by default
            }

            const obj = ObjectModel.load(objectData)
            const result = await API.post(sourceUrl, obj.create().getData())

            if (result.isError) {
                throw result.error
            }

            toast.show('Object created', {
                message: data.name
            })
            onCreated({ name: data.name })
            router.push(`/objects?created=${data.name}`)
        } catch (e: any) {
            setError(e?.message || 'Error creating object')
        } finally {
            setLoading(false)
        }
    }

    return (
        <YStack id="admin-dataview-create-dlg" padding="$3" paddingTop="$0" width={600} minHeight={500} flex={1}>
            <Tinted>
                <Stack marginBottom="$2">
                    <Text fontWeight={"500"} fontSize={30} color="$color">Create Object</Text>
                </Stack>
            </Tinted>

            <Text marginBottom="$4" fontSize="$3" color="$gray9">
                Define a data object with its fields. Objects are automatically stored and can be managed through the API.
            </Text>

            <Stack flex={1}>
                <ConfigureSlide 
                    data={data} 
                    setData={setData} 
                    keys={keys}
                    setKeys={setKeys}
                    errorMessage={error} 
                />
            </Stack>

            <XStack gap={40} justifyContent='center' marginTop="$4" alignItems="flex-end">
                <Button width={200} onPress={handleBack} disabled={loading}>
                    Back
                </Button>
                <Tinted>
                    <Button 
                        id={"admin-objects-add-btn"} 
                        width={200} 
                        onPress={handleCreate}
                        disabled={loading}
                    >
                        {loading ? "Creating..." : "Create Object"}
                    </Button>
                </Tinted>
            </XStack>
        </YStack>
    )
}

export const objectsOption: NetworkOption = {
    id: 'objects',
    name: 'Data Object',
    description: 'Create a data object with fields and automatic storage',
    icon: 'box',
    Component: ObjectsWizard
}

