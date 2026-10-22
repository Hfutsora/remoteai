import { useEffect, useState } from 'react';
import { guiText } from '../../i18n/guiText';
import { SidebarSearchInput } from '../../../../../shared/chat/SidebarSearchInput';
import type { GuiController } from './controller';
import type { GuiState } from './types';

const SEARCH_DELAY_MS = 300;

export function ThreadSearch({ state, controller, onFocus }: {
  state: GuiState; controller: GuiController; onFocus: () => void;
}) {
  const [query, setQuery] = useState(state.search);
  const search = query.trim();
  useEffect(() => { setQuery(state.search); }, [state.search]);
  useEffect(() => {
    if (search === state.search || state.connection !== 'ready') return;
    const timer = setTimeout(() => controller.filter(search, state.archived), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, state.search, state.archived, state.connection, controller]);
  return <SidebarSearchInput inset value={query} onChange={setQuery} label={guiText('搜索对话')}
    clearLabel={guiText('清空搜索')} onFocus={onFocus}
    onSubmit={() => { if (state.connection === 'ready') controller.filter(search, state.archived); }} />;
}
