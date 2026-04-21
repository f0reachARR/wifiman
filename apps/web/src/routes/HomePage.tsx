import { Button, Card, Grid, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';

const pillars = [
  {
    title: '型付きルーティング',
    body: '公開画面と保護画面を TanStack Router に集約し、遷移の破綻を減らします。',
  },
  {
    title: 'PWA + Offline',
    body: 'manifest と service worker を初期導入し、会場ネットワーク断を前提にします。',
  },
  {
    title: 'Dexie 同期基盤',
    body: 'SyncRecord と閲覧キャッシュを IndexedDB に持ち、後続機能の足場にします。',
  },
];

export function HomePage() {
  return (
    <Stack gap='xl'>
      <Card className='hero-card' padding='xl' radius='xl'>
        <Stack gap='lg'>
          <Group>
            <ThemeIcon size={52} radius='xl' color='teal'>
              WM
            </ThemeIcon>
            <div>
              <Text tt='uppercase' fw={700} c='teal'>
                Frontend Foundation
              </Text>
              <Title order={1}>WiFiMan Web</Title>
            </div>
          </Group>
          <Text size='lg'>
            React + Vite + TanStack + Mantine + PWA の基盤を整え、公開画面と保護画面を同じ App Shell
            で運用できる状態にしました。
          </Text>
          <Group>
            <Button component={Link} to='/login' size='md' color='teal'>
              運営ログインへ
            </Button>
            <Button component={Link} to='/team-access' size='md' variant='light' color='orange'>
              チームアクセスへ
            </Button>
          </Group>
        </Stack>
      </Card>

      <Grid>
        {pillars.map((pillar) => (
          <Grid.Col key={pillar.title} span={{ base: 12, md: 4 }}>
            <Card h='100%' className='feature-card' padding='lg' radius='xl'>
              <Stack gap='sm'>
                <Title order={3}>{pillar.title}</Title>
                <Text c='dimmed'>{pillar.body}</Text>
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );
}
