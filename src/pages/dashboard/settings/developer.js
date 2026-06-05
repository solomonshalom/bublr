/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useAuthState } from 'react-firebase-hooks/auth'

import { auth } from '../../../lib/firebase'
import { ApiKeyManager } from '../../../components/api-key-section'
import { LoadingContainer } from '../../../components/loading-container'

import DashboardLayout, {
  DashboardBody,
  useSidebar,
} from '../../../components/dashboard/dashboard-layout'
import PageHeader from '../../../components/dashboard/page-header'

const introStyle = css`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.25rem 0 1.5rem 0;
  color: var(--grey-3);
  font-size: 0.85rem;
`

const introTitleStyle = css`
  color: var(--grey-4);
  font-size: 0.95rem;
`

function DeveloperContent() {
  const { toggle } = useSidebar()
  const [user] = useAuthState(auth)

  return (
    <>
      <PageHeader title="Developer" onToggleSidebar={toggle} />
      <DashboardBody>
        <LoadingContainer isLoading={!user}>
          <div css={introStyle}>
            <span css={introTitleStyle}>API Keys</span>
            <span>Use these to programmatically access your Bublr posts.</span>
          </div>
          {user && <ApiKeyManager userId={user.uid} />}
        </LoadingContainer>
      </DashboardBody>
    </>
  )
}

export default function SettingsDeveloper() {
  return <DeveloperContent />
}

SettingsDeveloper.getLayout = function SettingsDeveloperLayout(page) {
  return <DashboardLayout pageTitle="Developer">{page}</DashboardLayout>
}
