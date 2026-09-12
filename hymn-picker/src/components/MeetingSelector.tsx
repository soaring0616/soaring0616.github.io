import type { MeetingType } from '../types';
import styles from './MeetingSelector.module.css';

/**
 * 選聚會類型 + 輸入主題關鍵字。
 *
 * 這個元件刻意「不自己記」選到哪一個 —— 選中的值由 Home 用 useState 保管，
 * 這裡只負責顯示 value、並在使用者操作時呼叫 onChange 往上通知。
 * 這就是「受控元件 (controlled component)」＋「狀態抬升 (lifting state up)」：
 * 因為 Home 也要拿這些值去跑 selectHymns，狀態就必須放在兩者共同的父層。
 */

interface MeetingSelectorProps {
  /** 所有聚會類型（由 Home 載入後傳下來） */
  meetingTypes: MeetingType[];
  /** 目前選到的聚會 id */
  selectedId: string;
  /** 使用者換聚會時呼叫 */
  onSelect: (id: string) => void;
  /** 目前的主題關鍵字 */
  theme: string;
  /** 使用者改主題時呼叫 */
  onThemeChange: (theme: string) => void;
}

export default function MeetingSelector({
  meetingTypes,
  selectedId,
  onSelect,
  theme,
  onThemeChange,
}: MeetingSelectorProps) {
  const selected = meetingTypes.find((m) => m.id === selectedId);

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        <span className={styles.label}>聚會類型</span>
        <select
          className={styles.control}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {meetingTypes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>主題關鍵字（選填）</span>
        <input
          className={styles.control}
          type="search"
          value={theme}
          placeholder="例如：十字架、憂慮、出遊、晨興"
          onChange={(e) => onThemeChange(e.target.value)}
        />
      </label>

      {selected && (
        <div className={styles.hint}>
          建議 {selected.suggestedCount} 首
          {selected.sections && `，分 ${selected.sections.length} 段`}。
          <ul className={styles.rules}>
            {selected.include.map((c) => (
              <li key={`in-${c}`} className={styles.include}>
                {c}
              </li>
            ))}
            {selected.exclude.map((c) => (
              <li key={`ex-${c}`} className={styles.exclude}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
