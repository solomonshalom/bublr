/** @jsxImportSource @emotion/react */
import { useAuthState } from 'react-firebase-hooks/auth'

import { auth } from '../../../lib/firebase'
import { ProfileEditor } from '../../../components/profile-settings-modal'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'

function PersonalContent() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)

  return (
    <>
      <PageHeader title="Personal" onToggleSidebar={toggle} />
      <DashboardBody>
        <ProfileEditor uid={user?.uid} authEmail={user?.email} section="personal" />
      </DashboardBody>
    </>
  )
}

export default function SettingsPersonal() {
  return <PersonalContent />
}

SettingsPersonal.getLayout = function SettingsPersonalLayout(page) {
  return <DashboardLayout pageTitle="Personal">{page}</DashboardLayout>
}
