import { PageHelpHeading } from './PageHelp';
import type { PageHelpTopic } from '../lib/page-help';
import type { ReactNode } from 'react';
import styles from './WorkspacePrimitives.module.css';

type WorkspaceTitlePanelProps = {
  title: string;
  helpTopic?: PageHelpTopic;
  className?: string;
};

type WorkspaceSummaryGridProps = {
  children: ReactNode;
  className?: string;
  label: string;
};

type WorkspaceSummaryTileProps = {
  label: string;
  value: ReactNode;
  helper: string;
  tone?: 'neutral' | 'blue' | 'copper' | 'green';
  className?: string;
};

const summaryToneClasses: Record<NonNullable<WorkspaceSummaryTileProps['tone']>, string> = {
  neutral: styles.summaryToneNeutral,
  blue: styles.summaryToneBlue,
  copper: styles.summaryToneCopper,
  green: styles.summaryToneGreen,
};

function joinClassNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

export function WorkspaceTitlePanel({ title, className, helpTopic }: WorkspaceTitlePanelProps) {
  return (
    <section className={joinClassNames(styles.titlePanel, className)}>
      <div>
        {helpTopic ? <PageHelpHeading topic={helpTopic}><h1>{title}</h1></PageHelpHeading> : <h1>{title}</h1>}
      </div>
    </section>
  );
}

export function WorkspaceSummaryGrid({ children, className, label }: WorkspaceSummaryGridProps) {
  return (
    <section className={joinClassNames(styles.summaryGrid, className)} aria-label={label}>
      {children}
    </section>
  );
}

export function WorkspaceSummaryTile({
  label,
  value,
  helper,
  tone = 'neutral',
  className,
}: WorkspaceSummaryTileProps) {
  return (
    <article className={joinClassNames(styles.summaryTile, summaryToneClasses[tone], className)}>
      <div>
        <span>{label}</span>
        <small>{helper}</small>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

export { styles as workspaceStyles };
