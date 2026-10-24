import { Trash2 } from 'lucide-react';
import { displayText } from '../i18n';

export function DownloadBatchDelete({ count, busy, remove, text = displayText }: {
  count: number; busy: boolean; remove: () => void; text?: typeof displayText;
}) {
  return <button type="button" className="download-button download-danger download-batch-delete"
    disabled={!count || busy} onClick={remove}>
    <Trash2 size={16} aria-hidden />
    {count ? text('client.downloads.deleteSelectedCount', { count }) : text('client.downloads.deleteSelected')}
  </button>;
}
