'use client'

import { useEffect, useState } from 'react'
import { AreaCongressista } from '@/components/cieps'
import { fetchJsonWithTimeout } from '@/lib/client/fetchWithTimeout'

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null)
  const [nome, setNome] = useState('Congressista')
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const data = await fetchJsonWithTimeout<{
          data?: {
            _id?: string
            nome?: string
            name?: string
            informacoes_usuario?: { nome?: string }
          }
        }>('/api/get/usuariosInformacoes')

        setUserId(data?.data?._id || null)
        setNome(
          data?.data?.informacoes_usuario?.nome ||
          data?.data?.nome ||
          data?.data?.name ||
          'Congressista'
        )
      } catch {
        setUserId(null)
        setNome('Congressista')
        setLoadError('Atualize a página ou tente novamente mais tarde. O restante do painel continua disponível.')
      }
    }

    fetchUserInfo()
  }, [])

  return <AreaCongressista nome={nome} userId={userId} loadError={loadError} />
}
