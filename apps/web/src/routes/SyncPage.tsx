import { Alert, Badge, Button, Card, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { apiQueryKeys } from '../lib/api/client.js';
import { getSyncOverview, listIssueReportSyncRecords } from '../lib/db/appDb.js';
import { syncIssueReportRecord } from '../lib/syncEngine.js';

export function SyncPage() {
  const queryClient = useQueryClient();
  const syncOverview = useQuery({
    queryKey: apiQueryKeys.syncOverview,
    queryFn: getSyncOverview,
  });
  const issueReportSyncRecords = useQuery({
    queryKey: ['sync-records', 'issue-report'],
    queryFn: () =>
      listIssueReportSyncRecords({ statuses: ['pending', 'processing', 'failed', 'conflict'] }),
  });

  const handleRetry = async (recordId: string) => {
    const result = await syncIssueReportRecord(recordId, queryClient);

    notifications.show({
      color:
        result?.status === 'done' ? 'teal' : result?.status === 'conflict' ? 'yellow' : 'orange',
      title: result?.status === 'done' ? '再送しました' : '同期状態を更新しました',
      message: result?.errorMessage ?? result?.status ?? '同期を更新しました',
    });
  };

  return (
    <Stack gap='lg'>
      <div>
        <Title order={2}>同期状況</Title>
        <Text c='dimmed'>pending / failed / conflict と最終同期日時、対象一覧を確認できます。</Text>
      </div>
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Pending
            </Text>
            <Title order={3}>{syncOverview.data?.pending ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Failed
            </Text>
            <Title order={3}>{syncOverview.data?.failed ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Conflict
            </Text>
            <Title order={3}>{syncOverview.data?.conflict ?? 0}</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Text size='sm' c='dimmed'>
              Last Sync
            </Text>
            <Title order={4}>{syncOverview.data?.lastUpdatedAt ?? 'なし'}</Title>
          </Card>
        </Grid.Col>
      </Grid>

      <Card className='feature-card' padding='lg' radius='xl'>
        <Stack gap='md'>
          <div>
            <Title order={3}>対象一覧</Title>
            <Text c='dimmed'>
              online 復帰時は pending を自動送信します。failed はここから再送できます。
            </Text>
          </div>

          {(issueReportSyncRecords.data ?? []).map((record) => (
            <Card key={record.id} withBorder>
              <Stack gap='xs'>
                <Group justify='space-between'>
                  <div>
                    <Text fw={700}>{record.payload.symptom}</Text>
                    <Text size='sm' c='dimmed'>
                      tournament {record.tournamentId} / team {record.payload.teamId}
                    </Text>
                  </div>
                  <Badge
                    variant='light'
                    color={
                      record.status === 'failed'
                        ? 'red'
                        : record.status === 'conflict'
                          ? 'yellow'
                          : 'orange'
                    }
                  >
                    {record.status}
                  </Badge>
                </Group>

                {record.status === 'conflict' ? (
                  <Alert color='yellow' variant='light'>
                    conflict を検知しました。サーバ側により新しい状態がある可能性があります。
                  </Alert>
                ) : null}

                {record.payload.description ? (
                  <Text size='sm'>{record.payload.description}</Text>
                ) : null}

                {record.errorMessage ? <Text size='sm'>{record.errorMessage}</Text> : null}

                <Group justify='space-between'>
                  <Text size='sm' c='dimmed'>
                    queued {record.queuedAt}
                  </Text>
                  <Group>
                    <Button
                      component={Link}
                      size='xs'
                      to={`/tournaments/${record.tournamentId}/issue-reports/${record.entityId}`}
                      variant='subtle'
                    >
                      詳細を開く
                    </Button>
                    {record.status === 'failed' ? (
                      <Button size='xs' variant='light' onClick={() => void handleRetry(record.id)}>
                        failed を再送
                      </Button>
                    ) : null}
                  </Group>
                </Group>
              </Stack>
            </Card>
          ))}

          {(issueReportSyncRecords.data?.length ?? 0) === 0 ? (
            <Text c='dimmed'>未同期の対象はありません。</Text>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
