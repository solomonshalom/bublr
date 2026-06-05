/** @jsxImportSource @emotion/react */
import { useAuthState } from 'react-firebase-hooks/auth'

import { auth } from '../../../lib/firebase'
import { ProfileEditor } from '../../../components/profile-settings-modal'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'

function CustomizationContent() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)

  return (
    <>
      <PageHeader title="Customization" onToggleSidebar={toggle} />
      <DashboardBody>
        <ProfileEditor uid={user?.uid} authEmail={user?.email} section="customization" />
      </DashboardBody>
    </>
  )
}

export default function SettingsCustomization() {
  return <CustomizationContent />
}

SettingsCustomization.getLayout = function SettingsCustomizationLayout(page) {
  return <DashboardLayout pageTitle="Customization">{page}</DashboardLayout>
}
