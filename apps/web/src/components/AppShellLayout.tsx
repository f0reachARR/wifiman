import { AppShell, Badge, Box, Burger, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useAuthActions, useAuthSession } from '../lib/useAuthSession.js';

type NavItem = {
  label: string;
  to: '/' | '/login' | '/team-access' | '/offline' | '/app' | '/app/sync';
  privateOnly?: boolean;
  publicOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: 'トップ', to: '/' },
  { label: '運営ログイン', to: '/login', publicOnly: true },
  { label: 'チームアクセス', to: '/team-access', publicOnly: true },
  { label: 'オフライン', to: '/offline' },
  { label: 'ダッシュボード', to: '/app', privateOnly: true },
  { label: '同期状況', to: '/app/sync', privateOnly: true },
];

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}

export function AppShellLayout({ children }: PropsWithChildren) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const online = useOnlineStatus();
  const { data: session } = useAuthSession();
  const { signOut } = useAuthActions();

  const visibleItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.privateOnly) {
        return Boolean(session);
      }

      if (item.publicOnly) {
        return !session;
      }

      return true;
    });
  }, [session]);

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding='lg'
      className='app-shell'
    >
      <AppShell.Header className='app-shell__header'>
        <Group h='100%' justify='space-between' px='md'>
          <Group gap='sm'>
            <Burger opened={opened} onClick={toggle} hiddenFrom='sm' size='sm' />
            <Box>
              <Title order={3}>WiFiMan</Title>
              <Text size='sm' c='dimmed'>
                会場オフライン前提の WiFi 運用支援
              </Text>
            </Box>
          </Group>
          <Group gap='sm'>
            <Badge color={online ? 'teal' : 'orange'} variant='light'>
              {online ? 'Online' : 'Offline'}
            </Badge>
            {session ? (
              <Button
                color='dark'
                variant='subtle'
                onClick={async () => {
                  signOut();
                  close();
                  await navigate({ to: '/' });
                }}
              >
                セッションを終了
              </Button>
            ) : null}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className='app-shell__navbar' p='md'>
        <Stack gap='xs'>
          {visibleItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link ${pathname === item.to ? 'nav-link--active' : ''}`}
              onClick={() => close()}
            >
              {item.label}
            </Link>
          ))}
        </Stack>
        <Box mt='auto' pt='lg'>
          <Text size='sm' c='dimmed'>
            App Shell、型付きルーティング、PWA、ローカル同期基盤を 1 つに集約しています。
          </Text>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className='app-shell__backdrop' />
        <Box className='app-shell__content'>{children}</Box>
      </AppShell.Main>
    </AppShell>
  );
}
