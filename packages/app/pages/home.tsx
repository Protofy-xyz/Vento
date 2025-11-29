import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { initParticlesAtom } from 'protolib/components/particles/ParticlesEngineAtom'
import { ParticlesView } from 'protolib/components/particles/ParticlesView'
import { Page } from 'protolib/components/Page'
import { basicParticlesMask } from 'protolib/components/particles/particlesMasks/basicParticlesMask'
import { Protofy } from "protobase";
import SpotLight from 'protolib/components/SpotLight'
import { DefaultLayout } from 'protolib/components/layout/DefaultLayout'
import { Section } from 'protolib/components/Section'

const Home = () => {
  const initParticles = useSetAtom(initParticlesAtom)

  useEffect(() => {
    initParticles()
  }, [initParticles])

  return (
    <Page
      style={{
        height: '100vh',
        margin: 0,
        padding: 0,
        fontFamily: "'Inter', sans-serif",
        color: '#fff8e1',
        fontSize: '10px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <DefaultLayout
        header={null}
        title="Protofy"
        description="Made with love from Barcelona"
        footer={null}
      >
        <Section>
          {/* <ParticlesView options={basicParticlesMask()} /> */}
          <SpotLight t="20vh" />

          <a
            href="/workspace/network"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '0.75rem',
              padding: '1rem',
              zIndex: 1,
              cursor: 'pointer',
            }}
          >
            <img
              src="/public/vento-logo.png"
              alt="Vento logo"
              style={{
                width: '240px',
                filter: 'invert(1)',
                animation: 'float 5s ease-in-out infinite',
                marginBottom: '2.5rem',
              }}
            />
          </a>

          <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes progress {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
        </Section>
      </DefaultLayout>
    </Page>
  )
}

export default {
  route: Protofy("route", "/"),
  component: (props) => <Home {...props} />
};
