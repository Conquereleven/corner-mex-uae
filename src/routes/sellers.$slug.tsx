import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/sellers/$slug')({
  beforeLoad: () => {
    throw redirect({ to: '/shop' })
  },
})
