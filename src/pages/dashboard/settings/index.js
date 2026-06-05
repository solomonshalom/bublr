import { useEffect } from 'react'
import { useRouter } from 'next/router'

import DashboardLayout from '../../../components/dashboard/dashboard-layout'

export default function SettingsIndex() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/settings/personal')
  }, [router])

  return null
}

SettingsIndex.getLayout = function SettingsIndexLayout(page) {
  return <DashboardLayout pageTitle="Settings">{page}</DashboardLayout>
}
