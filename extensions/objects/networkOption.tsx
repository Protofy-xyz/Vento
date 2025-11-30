import React, { useState } from 'react'
import { API } from 'protobase'
import { YStack, XStack, ScrollView, useToastController, Button, Text, Stack, Input, Select } from "@my/ui"
import { ObjectModel } from './objectsSchemas'
import { Tinted } from 'protolib/components/Tinted'
import { useRouter } from 'solito/navigation'
import type { NetworkOption } from '../network/options'
import { Trash2, Plus, ChevronDown } from '@tamagui/lucide-icons'

const sourceUrl = '/api/core/v1/objects'

const fieldTypes = [
    { value: 'string', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'date', label: 'Date' },
    { value: 'array', label: 'Array' },
    { value: 'object', label: 'Object' },
    { value: 'record', label: 'Record' },
]

const isNameValid = (text: string) => {
    return text !== '' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text)
}

const isFieldNameValid = (text: string) => {
    return text !== '' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(text)
}

type FieldDefinition = {
    name: string
    type: string
}

const ConfigureSlide = ({ 
    data, 
    setData, 
    fields, 
    setFields, 
    errorMessage = '' 
}: { 
    data: any
    setData: (data: any) => void
    fields: FieldDefinition[]
    setFields: (fields: FieldDefinition[]) => void
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

    const addField = () => {
        setFields([...fields, { name: '', type: 'string' }])
    }

    const removeField = (index: number) => {
        setFields(fields.filter((_, i) => i !== index))
    }

    const updateField = (index: number, key: keyof FieldDefinition, value: string) => {
        const newFields = [...fields]
        newFields[index] = { ...newFields[index], [key]: value }
        setFields(newFields)
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

                {/* Fields */}
                <YStack gap="$2">
                    <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize="$4" fontWeight="600" color="$gray11">Fields</Text>
                        <Tinted>
                            <Button size="$2" icon={Plus} onPress={addField}>
                                Add Field
                            </Button>
                        </Tinted>
                    </XStack>

                    {fields.length === 0 && (
                        <Text fontSize="$3" color="$gray9" textAlign="center" padding="$4">
                            No fields yet. Add fields to define your object structure.
                        </Text>
                    )}

                    {fields.map((field, index) => (
                        <XStack key={index} gap="$2" alignItems="center">
                            <Input
                                flex={1}
                                value={field.name}
                                onChangeText={(text) => updateField(index, 'name', text)}
                                placeholder="fieldName"
                                size="$3"
                            />
                            <Select
                                value={field.type}
                                onValueChange={(value) => updateField(index, 'type', value)}
                                size="$3"
                            >
                                <Select.Trigger width={130} iconAfter={ChevronDown}>
                                    <Select.Value placeholder="Type" />
                                </Select.Trigger>
                                <Select.Content zIndex={200000}>
                                    <Select.ScrollUpButton />
                                    <Select.Viewport>
                                        {fieldTypes.map((type, i) => (
                                            <Select.Item key={type.value} index={i} value={type.value}>
                                                <Select.ItemText>{type.label}</Select.ItemText>
                                            </Select.Item>
                                        ))}
                                    </Select.Viewport>
                                    <Select.ScrollDownButton />
                                </Select.Content>
                            </Select>
                            <Button 
                                size="$2" 
                                icon={Trash2} 
                                chromeless 
                                onPress={() => removeField(index)}
                                hoverStyle={{ backgroundColor: '$red3' }}
                            />
                        </XStack>
                    ))}
                </YStack>
            </YStack>
        </ScrollView>
    )
}

const ObjectsWizard = ({ onCreated, onBack }: { onCreated: (data?: any) => void, onBack?: () => void }) => {
    const toast = useToastController()
    const router = useRouter()
    const [data, setData] = useState({ name: '' })
    const [fields, setFields] = useState<FieldDefinition[]>([
        { name: 'name', type: 'string' }
    ])
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

        // Validate fields
        const invalidFields = fields.filter(f => !isFieldNameValid(f.name))
        if (invalidFields.length > 0) {
            setError('All field names must be valid (start with letter, only letters/numbers/underscores)')
            return
        }

        // Check for duplicate field names
        const fieldNames = fields.map(f => f.name)
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index)
        if (duplicates.length > 0) {
            setError(`Duplicate field names: ${duplicates.join(', ')}`)
            return
        }

        setLoading(true)
        setError('')

        try {
            // Build keys object from fields
            const keys: Record<string, { type: string; modifiers?: any[] }> = {}
            
            // First field with 'id' modifier
            let isFirstField = true
            for (const field of fields) {
                if (field.name) {
                    keys[field.name] = {
                        type: field.type,
                        modifiers: isFirstField ? [{ name: 'id', params: [] }] : []
                    }
                    isFirstField = false
                }
            }

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
                    fields={fields}
                    setFields={setFields}
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

