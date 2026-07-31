'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Confirmacao } from '@/components/cieps'
import { fetchWithTimeout } from '@/lib/client/fetchWithTimeout'

export default function SuaInscricaoFoiConfirmada() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()

  const confirmarAnimacaoInscricao = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetchWithTimeout('/api/post/confirmarAnimacaoInscricao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        throw new Error(`Erro: ${response.status}`)
      }

      router.push('/painel')
    } catch {
      setError('Tente novamente. Sua inscrição continua confirmada e nenhum dado foi perdido.')
      setIsLoading(false)
    }
  }

  return <Confirmacao onContinue={confirmarAnimacaoInscricao} isLoading={isLoading} error={error} />
}
