import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Claim } from '@/lib/types'
import { useAuth } from './useAuth'

export function useMyClaims() {
  const { isLoggedIn } = useAuth()
  return useQuery({ queryKey: ['me', 'claims'], queryFn: api.myClaims, enabled: isLoggedIn })
}

export function useItemClaims(itemId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['item', itemId, 'claims'],
    queryFn: () => api.itemClaims(itemId),
    enabled,
  })
}

function useInvalidateClaimData() {
  const qc = useQueryClient()
  return (claim: Claim) => {
    void qc.invalidateQueries({ queryKey: ['item', claim.item.id] })
    void qc.invalidateQueries({ queryKey: ['me'] })
    void qc.invalidateQueries({ queryKey: ['admin'] })
    void qc.invalidateQueries({ queryKey: ['items'] })
    void qc.invalidateQueries({ queryKey: ['notifications'] })
  }
}

export function useCreateClaim(itemId: number) {
  const invalidate = useInvalidateClaimData()
  return useMutation({
    mutationFn: async (input: { proof_text: string; secret_answer: string; photo: File | null }) => {
      const claim = await api.createClaim(itemId, {
        proof_text: input.proof_text,
        secret_answer: input.secret_answer,
      })
      if (!input.photo) return { claim, photoError: null as string | null }
      try {
        const updated = await api.uploadProofPhoto(claim.id, input.photo)
        return { claim: updated, photoError: null }
      } catch (err) {
        return { claim, photoError: err instanceof Error ? err.message : 'The photo did not upload.' }
      }
    },
    onSuccess: ({ claim }) => invalidate(claim),
  })
}

export function useDecideClaim() {
  const invalidate = useInvalidateClaimData()
  return useMutation({
    mutationFn: ({ claimId, decision, note }: { claimId: number; decision: 'verify' | 'reject'; note: string }) =>
      decision === 'verify' ? api.verifyClaim(claimId, note) : api.rejectClaim(claimId, note),
    onSuccess: invalidate,
  })
}

export function useHandover() {
  const invalidate = useInvalidateClaimData()
  return useMutation({
    mutationFn: ({ claimId, code }: { claimId: number; code: string }) => api.handover(claimId, code),
    onSuccess: invalidate,
  })
}
