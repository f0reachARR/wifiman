import { Card, Grid, Stack, Text, Title } from '@mantine/core';

const offlineNotes = [
  'PWA manifest と GenerateSW により静的アセットをオフライン利用できます。',
  'API runtime cache は未導入とし、誤ったレスポンス再利用を避けています。',
  '閲覧キャッシュと同期レコードは Dexie に分離し、のちの同期 UI に備えます。',
];

export function OfflinePage() {
  return (
    <Stack gap='lg'>
      <div>
        <Title order={2}>オフライン運用</Title>
        <Text c='dimmed'>
          会場ネットワーク断でも画面遷移とローカル閲覧キャッシュを維持する前提です。
        </Text>
      </div>
      <Grid>
        {offlineNotes.map((note) => (
          <Grid.Col key={note} span={{ base: 12, md: 4 }}>
            <Card className='feature-card' h='100%' padding='lg' radius='xl'>
              <Text>{note}</Text>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );
}
