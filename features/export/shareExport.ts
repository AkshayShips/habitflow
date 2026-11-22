import { Platform } from 'react-native';

/** Delivers the export: a download on web, the system share sheet on iOS/Android. Returns false if sharing isn't possible. */
export async function deliverExport(fileName: string, contents: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export your HabitFlow data', UTI: 'public.json' });
  return true;
}
