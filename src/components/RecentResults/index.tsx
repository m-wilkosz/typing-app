import { useState, useEffect } from 'react';
import { RecentResultsData } from 'App';
import { IconKeyboardArrowDown } from 'assets/image';
import { AlertOutsideClick, Tooltip } from 'components/UI';
import { TypingResult } from 'components/Typing/types';
import ResultButton from './ResultButton';
import styles from 'styles/RecentResults/RecentResults.module.scss';

interface Props {
  data: RecentResultsData;
  onPreviewResult: (result: TypingResult) => void;
  className?: string;
}

export default function RecentResults(props: Props) {
  const { data, onPreviewResult, className } = props;

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
      }
    };

    if (expanded) {
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  const expandButtonText = expanded ? 'hide recent' : 'show recent';

  return (
    <AlertOutsideClick
      onOutsideClick={() => setExpanded(false)}
      event="click"
      handleWhen={expanded}
      className={`${styles.container} ${expanded ? styles.expanded : ''} ${
        className || ''
      }`}
    >
      <div className={styles.absoluteWrapper}>
        <div className={`${styles.lineText} ${styles.lineTextBest}`}>best</div>
        <div className={styles.bestResultButtonWrapper}>
          <ResultButton
            result={data.best}
            className={styles.bestResultButton}
            onClick={() => {
              onPreviewResult(data.best);
              setExpanded(false);
            }}
          />
          <Tooltip
            text={expandButtonText}
            className={styles.expandWrapper}
            showOnHover
          >
            <button
              className={`${styles.expand} ${expanded ? styles.showLess : ''}`}
              onClick={() => setExpanded((state) => !state)}
              aria-label={expandButtonText}
            >
              <IconKeyboardArrowDown className={styles.expandIcon} />
            </button>
          </Tooltip>
        </div>

        {expanded && (
          <div className={styles.recentWrapper}>
            <div className={`${styles.lineText} ${styles.lineTextRecent}`}>
              recent
            </div>
            <ul>
              {data.recent.map((result) => (
                <li className={styles.li}>
                  <ResultButton
                    result={result}
                    includeDate
                    onClick={() => {
                      onPreviewResult(result);
                      setExpanded(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AlertOutsideClick>
  );
}
