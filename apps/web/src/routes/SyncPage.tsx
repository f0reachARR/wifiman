import { Badge, Button, Card, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { apiQueryKeys } from '../lib/api/client.js';
import { getSyncOverview, listIssueReportSyncRecords } from '../lib/db/appDb.js';

export function SyncPage() {
  const syncOverview = useQuery({
    queryKey: apiQueryKeys.syncOverview,
    queryFn: getSyncOverview,
  });
  const issueReportSyncRecords = useQuery({
    queryKey: ['sync-records', 'issue-report'],
    queryFn: () => listIssueReportSyncRecords({ statuses: ['pending', 'processing', 'failed'] }),
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

      <Card className='feature-card' padding='lg' radius='xl'>
        <Stack gap='md'>
          <div>
            <Title order={3}>未同期の不具合報告</Title>
            <Text c='dimmed'>
              local pending / failed レコードから詳細へ進み、内容確認と再送を行えます。
            </Text>
          </div>

          {issueReportSyncRecords.data?.map((record) => (
            <Card key={record.id} withBorder>
              <Stack gap='xs'>
                <Group justify='space-between'>
                  <div>
                    <Text fw={700}>
                      {record.payload.symptom} / {record.payload.severity}
                    </Text>
                    <Text size='sm' c='dimmed'>
                      {record.payload.band} / CH {record.payload.channel}
                    </Text>
                  </div>
                  <Badge variant='light' color={record.status === 'failed' ? 'red' : 'orange'}>
                    {record.status}
                  </Badge>
                </Group>
                {record.payload.description ? (
                  <Text size='sm'>{record.payload.description}</Text>
                ) : null}
                <Group justify='space-between'>
                  <Text size='sm' c='dimmed'>
                    queued: {record.queuedAt}
                  </Text>
                  <Button
                    component={Link}
                    size='xs'
                    to={`/tournaments/${record.tournamentId}/issue-reports/${record.entityId}`}
                    variant='light'
                  >
                    詳細を開く
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}

          {issueReportSyncRecords.data?.length === 0 ? (
            <Text c='dimmed'>未同期の不具合報告はありません。</Text>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
