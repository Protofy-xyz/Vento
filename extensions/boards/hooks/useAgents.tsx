// useAgents.ts
import { useState, useEffect, useCallback } from 'react'
import { API } from 'protobase'
import { useEventEffect } from '@extensions/events/hooks'

export type Agent = {
    name: string
    target: string | null
    icon?: string | null
    tags?: string[]
    // Optional: keep the raw board in case we need other fields later
    raw?: any
}

type UseAgentsResult = {
    agents: Agent[]
    loading: boolean
    error: string | null
    reload: () => void
}

export const useAgents = (): UseAgentsResult => {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    // Fetch agents list from API
    const fetchAgents = useCallback(async () => {
        try {
            setError(null)

            const response = await API.get('/api/core/v1/boards/')

            if (response.isError) {
                setError(response.error || 'Error loading agents')
                return
            }

            const items = Array.isArray(response.data?.items)
                ? response.data.items
                : []

            setAgents(items)
        } catch (e: any) {
            console.error('Error fetching agents:', e)
            setError('Error loading agents')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchAgents() }, [fetchAgents])
    useEventEffect(() => { fetchAgents() }, { path: 'boards/create/#' })
    useEventEffect(() => { fetchAgents() }, { path: 'boards/delete/#' })


    return { agents, loading, error, reload: fetchAgents }
}
