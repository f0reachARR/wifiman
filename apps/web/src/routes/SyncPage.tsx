import { Card, Grid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiQueryKeys } from '../lib/api/client.js';
import { getSyncOverview } from '../lib/db/appDb.js';

export function SyncPage() {
  const syncOverview = useQuery({
    queryKey: apiQueryKeys.syncOverview,
    queryFn: getSyncOverview,
  });

  return (
    <Stack gap='lg'>
      <div>
        <Title order={2}>同期状況</Title>
        <Text c='dimmed'>Dexie の初期テーブルに保存されたローカル同期状態を確認できます。</Text>
      </div>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Total Records
            </Text>
            <Title order={3}>{syncOverview.data?.total ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Failed
            </Text>
            <Title order={3}>{syncOverview.data?.failed ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Last Updated
            </Text>
            <Title order={4}>{syncOverview.data?.lastUpdatedAt ?? 'なし'}</Title>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
