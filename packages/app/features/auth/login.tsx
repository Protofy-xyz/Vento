import { FormEvent, useEffect, useRef, useState } from 'react'
import { Button, Input, Paragraph, ProtofyLogoSVG, Spinner, Stack, YStack } from '@my/ui'
import { createSession, PendingResult, getPendingResult } from 'protobase'
import { DefaultLayout } from '../../layout/DefaultLayout'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'solito/navigation'
import { getErrorMessage } from "@my/ui"
import { SiteConfig } from '../../conf'
import { useSession, useSessionContext } from 'protolib/lib/useSession'
import { Auth } from 'protolib/lib/Auth'
import { Center } from 'protolib/components/Center'
import { HorizontalBox } from 'protolib/components/HorizontalBox'
import { Notice } from 'protolib/components/Notice'
import { Section } from 'protolib/components/Section'
import { SpotLight } from 'protolib/components/SpotLight'
import { ElevatedArea } from 'protolib/components/ElevatedArea'
import { BackgroundGradient } from 'protolib/components/BackgroundGradient'
import { Page } from 'protolib/components/Page'
import { LogoIcon } from 'protolib/components/LogoIcon'
import { useIsLoggedIn } from 'protolib/lib/useIsLoggedIn'
import { useSetAtom } from 'jotai'
import { ParticlesView } from 'protolib/components/particles/ParticlesView'
import { basicParticlesMask } from 'protolib/components/particles/particlesMasks/basicParticlesMask'
import { initParticlesAtom } from 'protolib/components/particles/ParticlesEngineAtom'
import { useThemeSetting } from '@tamagui/next-theme'

export function SignInPage() {
  const initParticles = useSetAtom(initParticlesAtom)
  const { resolvedTheme } = useThemeSetting()
  const darkMode = resolvedTheme === 'dark'
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (darkMode) initParticles()
  }, [initParticles, darkMode])

  return (
    <Page>
      <DefaultLayout
        title="Protofy"
        description="Made with love from Barcelona"
        footer={null}
      >
        <YStack f={1} overflow="hidden">
          <Section containerProps={{ f: 1 }} sectionProps={{ index: 0, p: 0 }}>
            <BackgroundGradient />
            <SpotLight t="20vh" />

            {/* Partículas solo en cliente y modo oscuro */}
            {isClient && darkMode && (
              <YStack
                fullscreen
                pointerEvents="none"
                zIndex={0}
                style={{ backgroundColor: 'transparent' }}
              >
                <ParticlesView
                  options={basicParticlesMask({
                    backgroundColor: 'transparent',
                    particleColors: ['#ffffff'],
                    linkColor: '#ffffff',
                  })}
                />
              </YStack>
            )}

            <Center>
              <Stack mt="-10vh">
                <ElevatedArea>
                  <HorizontalBox>
                    <SignIn darkMode={darkMode} isClient={isClient} />
                  </HorizontalBox>
                </ElevatedArea>
              </Stack>
            </Center>
          </Section>
        </YStack>
      </DefaultLayout>
    </Page>
  )
}

function SignIn({ darkMode, isClient }: { darkMode: boolean, isClient: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailRef = useRef(null)
  const [authState, setAuthState] = useState<PendingResult>(getPendingResult('pending'))
  const [session, setSession] = useSession()
  const [sessionContext, setSessionContext] = useSessionContext()
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = Object.fromEntries(searchParams.entries())

  useEffect(() => {
    // @ts-ignore
    emailRef.current?.focus()
  }, [])

  useEffect(() => {
    if (authState.isLoaded && authState.data) {
      setSession(createSession(authState.data.session.user, authState.data.session.token))
      setSessionContext(authState.data.context)
    }
  }, [authState])

  useIsLoggedIn(() => {
    // @ts-ignore
    document.location.href = query.return || '/'
  })

  const handleSignin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    Auth.login(email, password, setAuthState)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/core/v1/users/has', { credentials: 'include' })
        if (!res.ok) throw new Error('users/has failed')
        const data = await res.json()
        if (!cancelled) setHasUsers(!!data?.hasUsers)
      } catch {
        // fail safe: assume there ARE users so login flow isn't blocked if the check fails
        if (!cancelled) setHasUsers(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const logoStyle = {
    marginTop: '2.5rem',
    width: '120px',
    filter: !isClient
      ? 'none'
      : darkMode
        ? 'drop-shadow(0 0 10px #000000) invert(1)'
        : 'drop-shadow(0 0 10px var(--color5)) invert(0)',
    animation: 'float 6s ease-in-out infinite',
    marginBottom: '2.5rem',
  }

  return (
    <YStack ai="center" jc="center" p="$2">
      <YStack miw={300} maw={320} jc="space-between" p="$2" gap="$4">
        <YStack mb="$4">
          <LogoIcon o={0.9}>
            <img src="/public/vento-logo.png" alt="Vento logo" style={logoStyle} />
          </LogoIcon>
        </YStack>

        {hasUsers === false && (
          <Notice>
            {SiteConfig.signupEnabled ? (
              <YStack space="$2">
                <Paragraph>
                  No users have been created yet.<br/><br/>
                </Paragraph>
                <Paragraph>
                  Please{' '}
                  <Link
                    id="first-user-register-link"
                    href={`/auth/register${query.return ? `?return=${query.return}` : ''}`}
                    style={{ fontWeight: 800 }}
                  >
                    register the first account
                  </Link>
                  .
                </Paragraph>
              </YStack>
            ) : (
              <YStack space="$2">
                <Paragraph>
                  No users have been created yet!<br/><br/>
                </Paragraph>
                <Paragraph>
                  Create the first user from <strong>Config → Users</strong> and press <strong>(+)</strong>, or run:<br/>
                </Paragraph>
                <Paragraph>
                  <code>yarn add-user &lt;email&gt; &lt;password&gt; &lt;type&gt;</code><br/><br/>
                </Paragraph>
              </YStack>
            )}
          </Notice>
        )}

        {Boolean(authState.isError) && (
          <Notice>
            <Paragraph>{getErrorMessage(authState.error)}</Paragraph>
          </Notice>
        )}

        <form onSubmit={handleSignin}>
          <YStack space="$2" mt="$5">
            <Input
              id="sign-in-username-input"
              ref={emailRef}
              autoComplete="username"
              placeholder="username"
              value={email}
              onChange={(e) => setEmail(e.nativeEvent.text)}
              required
            />
            <Input
              id="sign-in-password-input"
              autoComplete="password"
              secureTextEntry
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.nativeEvent.text)}
              required
            />
            <Button
              id="sign-in-btn"
              type="submit"
              loading={authState.isLoading}
              disabled={!email || !password || authState.isLoading}
              mt="$5"
            >
              {session.loggedIn || authState.isLoading ? <Spinner /> : 'Sign in'}
            </Button>
          </YStack>
        </form>

        {SiteConfig.signupEnabled && (
          <YStack space="$2">
            <Paragraph theme="alt2" ta="center" size="$2">
              Don't have an account?{' '}
              <Link
                id="sign-up-link"
                href={`/auth/register${query.return ? `?return=${query.return}` : ''}`}
                style={{ fontWeight: '800' }}
              >
                Sign up.
              </Link>
            </Paragraph>
          </YStack>
        )}
      </YStack>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </YStack>
  )
}
