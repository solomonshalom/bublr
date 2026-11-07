/** @jsxImportSource @emotion/react */
import { useAuthState } from 'react-firebase-hooks/auth'
import { useDocumentData } from 'react-firebase-hooks/firestore'

import { auth, firestore } from '../../../lib/firebase'
import DashboardLayout, { DashboardBody, useSidebar } from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'
import CustomDomainPanel from '../../../components/dashboard/custom-domain-panel'

// Bublr Pro: the $4.99/month plan and the writer's own domain
function DomainContent() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)
  const [profile] = useDocumentData(user ? firestore.collection('users').doc(user.uid) : null)

  return (
    <>
      <PageHeader title="Custom domain" onToggleSidebar={toggle} />
      <DashboardBody>
        <CustomDomainPanel userId={user?.uid} username={profile?.name} />
      </DashboardBody>
    </>
  )
}

export default function SettingsDomain() {
  return <DomainContent />
}

SettingsDomain.getLayout = function SettingsDomainLayout(page) {
  return <DashboardLayout pageTitle="Custom domain">{page}</DashboardLayout>
}
