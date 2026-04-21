import { Badge, Card, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiQueryKeys } from '../lib/api/client.js';
import { getSyncOverview } from '../lib/db/appDb.js';
import { useAuthSession } from '../lib/useAuthSession.js';

export function AppDashboardPage() {
  const { data: session } = useAuthSession();
  const syncOverview = useQuery({
    queryKey: apiQueryKeys.syncOverview,
    queryFn: getSyncOverview,
  });

  return (
    <Stack gap='lg'>
      <div>
        <Group justify='space-between'>
          <div>
            <Title order={2}>共通 App Shell</Title>
            <Text c='dimmed'>認証済みセッション向けのダッシュボード骨格です。</Text>
          </div>
          <Badge color='teal' variant='light'>
            {session?.kind === 'operator' ? 'Operator' : 'Team Access'}
          </Badge>
        </Group>
      </div>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='xs'>
              <Text size='sm' c='dimmed'>
                Session
              </Text>
              <Title order={3}>
                {session?.kind === 'operator' ? session.displayName : session?.teamId}
              </Title>
              <Text c='dimmed'>
                {session?.kind === 'operator'
                  ? `server session: ${session.sessionId}`
                  : session
                    ? `team access: ${session.teamAccessId} (${session.role})`
                    : '認証情報を取得中です'}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='xs'>
              <Text size='sm' c='dimmed'>
                Pending Sync
              </Text>
              <Title order={3}>{syncOverview.data?.pending ?? 0}</Title>
              <Text c='dimmed'>IndexedDB 内の未同期レコード件数です。</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='xs'>
              <Text size='sm' c='dimmed'>
                View Cache
              </Text>
              <Title order={3}>Dexie Ready</Title>
              <Text c='dimmed'>公開データ閲覧キャッシュ用テーブルを初期化済みです。</Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
