import { Button, Card, Grid, Group, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useTournaments } from '../lib/useTeamManagement.js';

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
  const tournamentsQuery = useTournaments();

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
            会場全体の公開情報から、自チームの WiFi 構成と機材仕様の管理までを同一導線で扱います。
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

      <Stack gap='md'>
        <Group justify='space-between'>
          <div>
            <Title order={2}>公開中の大会</Title>
            <Text c='dimmed'>大会トップは未認証でも閲覧できます。</Text>
          </div>
        </Group>

        {tournamentsQuery.isLoading ? (
          <Group>
            <Loader color='teal' size='sm' />
            <Text c='dimmed'>大会一覧を読み込んでいます</Text>
          </Group>
        ) : (
          <Grid>
            {(tournamentsQuery.data ?? []).map((tournament) => (
              <Grid.Col key={tournament.id} span={{ base: 12, md: 6 }}>
                <Card className='feature-card' padding='lg' radius='xl'>
                  <Stack gap='sm'>
                    <Title order={3}>{tournament.name}</Title>
                    <Text c='dimmed'>
                      {tournament.venueName} / {tournament.startDate} - {tournament.endDate}
                    </Text>
                    {tournament.description ? <Text>{tournament.description}</Text> : null}
                    <Group>
                      <Button component={Link} to={`/tournaments/${tournament.id}`}>
                        大会トップへ
                      </Button>
                      <Button
                        component={Link}
                        to={`/tournaments/${tournament.id}/teams`}
                        variant='light'
                      >
                        チーム一覧
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Stack>
    </Stack>
  );
}
