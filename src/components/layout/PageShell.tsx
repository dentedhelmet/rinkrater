'use client'

interface PageShellProps {
  topBar: React.ReactNode
  children: React.ReactNode
  showTabBar?: boolean
  tabBar?: React.ReactNode
}

export function PageShell(props: PageShellProps) {
  const showTabBar = props.showTabBar !== false

  return (
    <div className="page-shell">
      <div className="page-topbar-fixed">
        {props.topBar}
      </div>

      <main className={'page-scroll-area scroll-y' + (showTabBar ? '' : ' no-tabbar')}>
        {props.children}
      </main>

      {showTabBar && props.tabBar && (
        <div className="page-tabbar-fixed">
          {props.tabBar}
        </div>
      )}

      <style jsx>{`
        .page-shell {
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
        }
        .page-topbar-fixed {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
        }
        .page-tabbar-fixed {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
        }
        .page-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 75px 12px 70px;
        }
        .page-scroll-area.no-tabbar {
          padding-bottom: 12px;
        }
        @media (min-width: 768px) {
          .page-topbar-fixed,
          .page-tabbar-fixed {
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            max-width: 1100px;
          }
        }
      `}</style>
    </div>
  )
}
