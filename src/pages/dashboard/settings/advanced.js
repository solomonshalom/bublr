/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useAuthState } from 'react-firebase-hooks/auth'

import { auth } from '../../../lib/firebase'
import ThemeToggle from '../../../components/theme-toggle'
import { ProfileEditor } from '../../../components/profile-settings-modal'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'
import { DsCard, DsSection } from '../../../components/dashboard/ds-section'

const appearanceRowStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
`

const appearanceLabelStyle = css`
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--grey-4);
  font-weight: 500;
`

const appearanceHintStyle = css`
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--grey-3);
  margin-top: 0.2rem;
  font-weight: 400;
`

function AdvancedContent() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)

  return (
    <>
      <PageHeader title="Advanced" onToggleSidebar={toggle} />
      <DashboardBody>
        <DsSection
          title="Appearance"
          description="Switch between light and dark themes."
        >
          <DsCard dashed>
            <div css={appearanceRowStyle}>
              <div>
                <div css={appearanceLabelStyle}>Theme</div>
                <span css={appearanceHintStyle}>
                  Follows your system preference unless you choose one here.
                </span>
              </div>
              <ThemeToggle />
            </div>
          </DsCard>
        </DsSection>

        <ProfileEditor uid={user?.uid} authEmail={user?.email} section="advanced" />
      </DashboardBody>
    </>
  )
}

export default function SettingsAdvanced() {
  return <AdvancedContent />
}

SettingsAdvanced.getLayout = function SettingsAdvancedLayout(page) {
  return <DashboardLayout pageTitle="Advanced">{page}</DashboardLayout>
}
