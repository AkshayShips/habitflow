import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, Chip } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { showToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { buildExport, EXPORT_SETS, exportFileName, serializeExport, type ExportSet } from '@/features/export/buildExport';
import { deliverExport } from '@/features/export/shareExport';
import { getDb } from '@/lib/localDb';
import { useTheme } from '@/theme/useTheme';

export default function ExportScreen() {
  const { spacing } = useTheme();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [picked, setPicked] = useState<ExportSet[]>(EXPORT_SETS.map((s) => s.id));
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!userId) return;
    setBusy(true);
    try {
      const data = await buildExport(await getDb(userId), picked);
      const ok = await deliverExport(exportFileName(), serializeExport(data));
      showToast(ok ? 'Export ready' : 'Sharing isn’t available on this device.', ok ? 'success' : 'error');
    } catch {
      showToast('Couldn’t create the export. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Export data" disabled={picked.length === 0} loading={busy} onPress={() => void run()} />}>
      <Card>
        <Text variant="title2">Take your data with you</Text>
        <Text secondary>
          Choose what to include. You’ll get one JSON file with your own data, ready to save or share. Deleted items and
          sync details are left out.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {EXPORT_SETS.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              selected={picked.includes(s.id)}
              onPress={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
            />
          ))}
        </View>
        <Text variant="footnote" secondary>
          The file is made on this device from your saved data. Journal text is included in plain text, so keep the file somewhere private.
        </Text>
      </Card>
    </Screen>
  );
}
